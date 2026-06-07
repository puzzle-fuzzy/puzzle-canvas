/**
 * 认证路由模块
 *
 * 提供注册、登录、令牌刷新、登出、获取当前用户等端点：
 *   POST   /register  — 注册新用户
 *   POST   /login     — 登录
 *   POST   /refresh   — 刷新 Access Token（使用 httpOnly cookie）
 *   POST   /logout    — 登出（清除 cookie + 吊销 refresh token）
 *   GET    /me        — 获取当前用户信息
 *
 * 通过 createAuthRoutes() 返回类型化的 Hono 子路由，
 * 在 server/index.ts 中以 app.route('/api/auth', ...) 挂载。
 */
import { Hono, type Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import { db as defaultDb } from '../db'
import { users, accounts, refreshTokens } from '../db/schema'
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  toPublicUser,
  type PublicUser,
  REFRESH_TOKEN_EXPIRY_MS,
} from '../utils/auth'

// ========== 类型 ==========

/** 路由依赖注入接口 */
interface AuthRouteDeps {
  db?: typeof defaultDb
}

/** 注册请求体 */
interface RegisterBody {
  email?: string
  username?: string
  password?: string
}

/** 登录请求体 */
interface LoginBody {
  email?: string
  password?: string
}

// ========== 辅助函数 ==========

/** 基础邮箱格式校验 */
function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.includes('@') && email.length >= 3 && email.length <= 254
}

/** 设置 httpOnly refresh cookie */
function setRefreshCookie(c: Context, token: string) {
  const isProd = process.env.NODE_ENV === 'production'
  setCookie(c, 'refresh_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/api/auth/refresh',
    maxAge: Math.floor(REFRESH_TOKEN_EXPIRY_MS / 1000),
  })
}

/** 清除 refresh cookie */
function clearRefreshCookie(c: Context) {
  const isProd = process.env.NODE_ENV === 'production'
  setCookie(c, 'refresh_token', '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/api/auth/refresh',
    maxAge: 0,
  })
}

/** 创建 refresh token 记录并写入 cookie */
function issueRefreshToken(c: Context, userId: string, db: typeof defaultDb) {
  const token = generateRefreshToken()
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)

  db.insert(refreshTokens).values({
    id: crypto.randomUUID(),
    userId,
    token,
    expiresAt,
  }).run()

  setRefreshCookie(c, token)
  return token
}

/** 签发 access token 并返回认证响应 */
function buildAuthResponse(c: Context, user: typeof users.$inferSelect, db: typeof defaultDb) {
  const publicUser = toPublicUser(user)
  const accessToken = signAccessToken({ userId: user.id, email: user.email })
  issueRefreshToken(c, user.id, db)
  return { user: publicUser, accessToken }
}

// ========== 路由工厂 ==========

export function createAuthRoutes(deps: AuthRouteDeps = {}) {
  const db = deps.db ?? defaultDb

  return new Hono()
    // ===== 注册 =====
    .post('/register', async (c) => {
      const body = await c.req.json<RegisterBody>()
      const { email, username, password } = body

      // 校验必填字段
      if (!email || !username || !password) {
        return c.json({ error: '缺少必要字段 (email, username, password)' }, 400)
      }

      // 校验邮箱格式
      if (!isValidEmail(email)) {
        return c.json({ error: '邮箱格式不正确' }, 400)
      }

      // 校验用户名长度
      if (username.length < 2 || username.length > 20) {
        return c.json({ error: '用户名长度应为 2-20 个字符' }, 400)
      }

      // 校验密码长度
      if (password.length < 6) {
        return c.json({ error: '密码长度至少 6 个字符' }, 400)
      }

      // 检查邮箱唯一性（先快速检查，INSERT 时仍有 UNIQUE 约束兜底）
      const existing = db.select({ id: users.id }).from(users).where(eq(users.email, email)).all()
      if (existing.length > 0) {
        return c.json({ error: '邮箱已被注册' }, 409)
      }

      // 判断是否首用户（自动成为 admin）
      // 在事务中执行 check + insert，防止并发注册时两人都成为 admin
      const userId = crypto.randomUUID()
      const passwordHash = await hashPassword(password)

      let userRole: 'admin' | 'member' = 'member'
      try {
        db.transaction((tx) => {
          const userCount = tx.select({ id: users.id }).from(users).limit(1).all()
          userRole = userCount.length === 0 ? 'admin' : 'member'
          tx.insert(users).values({
            id: userId,
            email,
            username,
            passwordHash,
            role: userRole,
          }).run()
        })
      } catch (err: unknown) {
        // UNIQUE 约束冲突 → 邮箱已被注册（处理 check-then-insert 的竞态窗口）
        if (err instanceof Error && err.message?.includes('UNIQUE constraint')) {
          return c.json({ error: '邮箱已被注册' }, 409)
        }
        throw err
      }

      // 创建 credentials 账户关联
      db.insert(accounts).values({
        id: crypto.randomUUID(),
        userId,
        provider: 'credentials',
        providerAccountId: email,
      }).run()

      // 查询刚创建的用户（获取完整字段）
      const user = db.select().from(users).where(eq(users.id, userId)).get()!

      return c.json(buildAuthResponse(c, user, db), 201)
    })

    // ===== 登录 =====
    .post('/login', async (c) => {
      const body = await c.req.json<LoginBody>()
      const { email, password } = body

      if (!email || !password) {
        return c.json({ error: '缺少必要字段 (email, password)' }, 400)
      }

      // 查找用户
      const user = db.select().from(users).where(eq(users.email, email)).get()
      if (!user) {
        return c.json({ error: '邮箱或密码错误' }, 401)
      }

      // 验证密码
      if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
        return c.json({ error: '邮箱或密码错误' }, 401)
      }

      // 检查账号状态
      if (user.status === 'disabled') {
        return c.json({ error: '账号已被禁用' }, 403)
      }

      // 更新最后登录时间
      db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).run()

      return c.json(buildAuthResponse(c, user, db), 200)
    })

    // ===== 刷新 Token =====
    .post('/refresh', async (c) => {
      const token = getCookie(c, 'refresh_token')

      if (!token) {
        return c.json({ error: '未提供刷新令牌' }, 401)
      }

      // 用事务保证 token 查找、验证、删除、签发新 token 的原子性
      let result: { user: PublicUser; accessToken: string } | null = null

      db.transaction((tx) => {
        const record = tx.select().from(refreshTokens).where(eq(refreshTokens.token, token)).get()
        if (!record) return

        // 检查是否过期
        if (record.expiresAt < new Date()) {
          tx.delete(refreshTokens).where(eq(refreshTokens.id, record.id)).run()
          return
        }

        // 查找关联用户
        const user = tx.select().from(users).where(eq(users.id, record.userId)).get()
        if (!user || user.status === 'disabled') {
          tx.delete(refreshTokens).where(eq(refreshTokens.id, record.id)).run()
          return
        }

        // 旋转：删除旧 token + 签发新 token（原子操作，防止并发刷新重复签发）
        tx.delete(refreshTokens).where(eq(refreshTokens.id, record.id)).run()

        const publicUser = toPublicUser(user)
        const accessToken = signAccessToken({ userId: user.id, email: user.email })
        const newToken = generateRefreshToken()
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)
        tx.insert(refreshTokens).values({
          id: crypto.randomUUID(),
          userId: user.id,
          token: newToken,
          expiresAt,
        }).run()

        setRefreshCookie(c, newToken)
        result = { user: publicUser, accessToken }
      })

      if (!result) {
        clearRefreshCookie(c)
        return c.json({ error: '刷新令牌已失效' }, 401)
      }

      return c.json(result, 200)
    })

    // ===== 登出 =====
    .post('/logout', async (c) => {
      const token = getCookie(c, 'refresh_token')

      if (token) {
        db.delete(refreshTokens).where(eq(refreshTokens.token, token)).run()
      }

      clearRefreshCookie(c)
      return c.json({ ok: true })
    })

    // ===== 获取当前用户 =====
    .get('/me', async (c) => {
      const authHeader = c.req.header('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: '未登录' }, 401)
      }

      const token = authHeader.slice(7)
      const payload = verifyAccessToken(token)
      if (!payload) {
        return c.json({ error: '登录已过期，请重新登录' }, 401)
      }

      const user = db.select().from(users).where(eq(users.id, payload.userId)).get()
      if (!user) {
        return c.json({ error: '用户不存在' }, 401)
      }

      if (user.status === 'disabled') {
        return c.json({ error: '账号已被禁用' }, 403)
      }

      return c.json({ user: toPublicUser(user) })
    })
}
