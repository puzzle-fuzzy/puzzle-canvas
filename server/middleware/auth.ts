/**
 * 认证中间件
 *
 * 验证 Authorization: Bearer <token> 头，
 * 将 userId 写入 Hono context 供下游路由使用。
 */
import type { Context, Next } from 'hono'
import { eq } from 'drizzle-orm'
import { db as defaultDb } from '../db'
import { users } from '../db/schema'
import { verifyAccessToken } from '../utils/auth'

/** 路由依赖注入接口 */
interface AuthMiddlewareDeps {
  db?: typeof defaultDb
}

/**
 * 创建认证中间件
 *
 * 成功时将 userId 写入 c.set('userId', ...)，
 * 失败时直接返回 401 JSON 响应。
 */
export function createAuthMiddleware(deps: AuthMiddlewareDeps = {}) {
  const db = deps.db ?? defaultDb

  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: '请先登录' }, 401)
    }

    const token = authHeader.slice(7)
    const payload = verifyAccessToken(token)

    if (!payload) {
      return c.json({ error: '登录已过期，请重新登录' }, 401)
    }

    // 验证用户存在且未被禁用
    const user = db.select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.id, payload.userId))
      .get()

    if (!user) {
      return c.json({ error: '用户不存在' }, 401)
    }

    if (user.status === 'disabled') {
      return c.json({ error: '账号已被禁用' }, 403)
    }

    // 将 userId 写入 context，下游路由通过 c.get('userId') 获取
    c.set('userId', payload.userId)
    await next()
  }
}
