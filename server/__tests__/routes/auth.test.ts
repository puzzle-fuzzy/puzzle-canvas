/**
 * 认证路由集成测试
 */
import { describe, it, expect, beforeEach } from 'bun:test'
import { createTestApp, TEST_USER, getAuthHeaders, createAuthenticatedTestApp, createTestDb } from '../setup'
import { createAuthRoutes } from '../../routes/auth'
import { Hono } from 'hono'

const json = (res: Response) => res.json() as Promise<Record<string, unknown>>

describe('认证路由', () => {
  let app: Hono

  beforeEach(() => {
    const test = createTestApp()
    app = test.app
  })

  // ===== POST /api/auth/register =====

  describe('注册', () => {
    it('正常注册返回 201', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'new@example.com',
          username: 'newuser',
          password: 'password123',
        }),
      })
      expect(res.status).toBe(201)
      const data = await json(res)
      expect(data.user).toBeDefined()
      expect(data.accessToken).toBeDefined()
      expect((data.user as Record<string, unknown>).email).toBe('new@example.com')
      expect((data.user as Record<string, unknown>).username).toBe('newuser')
      expect((data.user as Record<string, unknown>).role).toBe('member') // DB 中已有测试用户
    })

    it('缺少 email 返回 400', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'user', password: 'password123' }),
      })
      expect(res.status).toBe(400)
    })

    it('缺少 username 返回 400', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'password123' }),
      })
      expect(res.status).toBe(400)
    })

    it('密码太短返回 400', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', username: 'user', password: '12345' }),
      })
      expect(res.status).toBe(400)
    })

    it('用户名太短返回 400', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', username: 'a', password: 'password123' }),
      })
      expect(res.status).toBe(400)
    })

    it('无效邮箱格式返回 400', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'no-at-sign', username: 'user', password: 'password123' }),
      })
      expect(res.status).toBe(400)
    })

    it('重复邮箱返回 409', async () => {
      // 先注册
      await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dup@example.com', username: 'first', password: 'password123' }),
      })
      // 再次注册同邮箱
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dup@example.com', username: 'second', password: 'password123' }),
      })
      expect(res.status).toBe(409)
    })

    it('第二个用户角色为 member', async () => {
      await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'first@example.com', username: 'first', password: 'password123' }),
      })
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'second@example.com', username: 'second', password: 'password123' }),
      })
      expect(res.status).toBe(201)
      const data = await json(res)
      expect((data.user as Record<string, unknown>).role).toBe('member')
    })

    it('设置 httpOnly cookie', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'cookie@example.com', username: 'cookieuser', password: 'password123' }),
      })
      expect(res.status).toBe(201)
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('refresh_token=')
      expect(setCookie).toContain('HttpOnly')
    })
  })

  // ===== POST /api/auth/login =====

  describe('登录', () => {
    it('正确密码登录成功', async () => {
      // 先注册
      await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'login@example.com', username: 'loginuser', password: 'password123' }),
      })

      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'login@example.com', password: 'password123' }),
      })
      expect(res.status).toBe(200)
      const data = await json(res)
      expect(data.user).toBeDefined()
      expect(data.accessToken).toBeDefined()
    })

    it('错误密码返回 401', async () => {
      await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'wrong@example.com', username: 'wronguser', password: 'password123' }),
      })

      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'wrong@example.com', password: 'wrongpassword' }),
      })
      expect(res.status).toBe(401)
    })

    it('不存在的邮箱返回 401', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@example.com', password: 'password123' }),
      })
      expect(res.status).toBe(401)
    })

    it('缺少字段返回 400', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ===== POST /api/auth/refresh =====

  describe('刷新 Token', () => {
    it('有效 refresh token 可以刷新', async () => {
      // 注册获取 cookie
      const regRes = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'refresh@example.com', username: 'refreshuser', password: 'password123' }),
      })

      // 从 set-cookie 中提取 refresh_token
      const setCookie = regRes.headers.get('set-cookie')!
      const match = setCookie.match(/refresh_token=([^;]+)/)
      expect(match).toBeTruthy()

      const res = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { Cookie: `refresh_token=${match![1]}` },
      })
      expect(res.status).toBe(200)
      const data = await json(res)
      expect(data.accessToken).toBeDefined()
      expect(data.user).toBeDefined()
    })

    it('无效 refresh token 返回 401', async () => {
      const res = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { Cookie: 'refresh_token=invalid-token' },
      })
      expect(res.status).toBe(401)
    })

    it('无 cookie 返回 401', async () => {
      const res = await app.request('/api/auth/refresh', {
        method: 'POST',
      })
      expect(res.status).toBe(401)
    })
  })

  // ===== POST /api/auth/logout =====

  describe('登出', () => {
    it('登出返回 200 并清除 cookie', async () => {
      const res = await app.request('/api/auth/logout', {
        method: 'POST',
      })
      expect(res.status).toBe(200)
      const data = await json(res)
      expect(data.ok).toBe(true)
    })

    it('带 token 登出后无法刷新', async () => {
      // 注册获取 cookie
      const regRes = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'logout@example.com', username: 'logoutuser', password: 'password123' }),
      })
      const setCookie = regRes.headers.get('set-cookie')!
      const match = setCookie.match(/refresh_token=([^;]+)/)

      // 登出
      await app.request('/api/auth/logout', {
        method: 'POST',
        headers: { Cookie: `refresh_token=${match![1]}` },
      })

      // 刷新应失败
      const refreshRes = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { Cookie: `refresh_token=${match![1]}` },
      })
      expect(refreshRes.status).toBe(401)
    })
  })

  // ===== GET /api/auth/me =====

  describe('获取当前用户', () => {
    it('有效 token 返回用户信息', async () => {
      const headers = getAuthHeaders()
      const res = await app.request('/api/auth/me', { headers })
      expect(res.status).toBe(200)
      const data = await json(res)
      expect(data.user).toBeDefined()
      expect((data.user as Record<string, unknown>).id).toBe(TEST_USER.id)
    })

    it('无 token 返回 401', async () => {
      const res = await app.request('/api/auth/me')
      expect(res.status).toBe(401)
    })

    it('无效 token 返回 401', async () => {
      const res = await app.request('/api/auth/me', {
        headers: { Authorization: 'Bearer invalid-token' },
      })
      expect(res.status).toBe(401)
    })
  })
})

// ===== 带认证的节点路由测试 =====

describe('带认证的节点路由', () => {
  let app: Hono
  let authHeaders: Record<string, string>

  beforeEach(() => {
    const test = createAuthenticatedTestApp()
    app = test.app
    authHeaders = getAuthHeaders()
  })

  it('无 token 时 GET 返回 401', async () => {
    const res = await app.request('/api/nodes')
    expect(res.status).toBe(401)
  })

  it('有 token 时 GET 返回 200', async () => {
    const res = await app.request('/api/nodes', { headers: authHeaders })
    expect(res.status).toBe(200)
  })

  it('POST 创建的节点绑定当前用户', async () => {
    const res = await app.request('/api/nodes', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'auth-node-1',
        type: 'urlNode',
        positionX: 100,
        positionY: 200,
      }),
    })
    expect(res.status).toBe(201)
    const data = await json(res)
    expect(data.userId).toBe(TEST_USER.id)
  })

  it('GET 只返回当前用户的节点', async () => {
    // 创建一个节点
    await app.request('/api/nodes', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'my-node',
        type: 'urlNode',
        positionX: 0,
        positionY: 0,
      }),
    })

    const res = await app.request('/api/nodes', { headers: authHeaders })
    expect(res.status).toBe(200)
    const data = await res.json() as Record<string, unknown>[]
    expect(data.every((n) => n.userId === TEST_USER.id)).toBe(true)
  })

  it('无 token 时 POST 返回 401', async () => {
    const res = await app.request('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'no-auth-node',
        type: 'urlNode',
        positionX: 0,
        positionY: 0,
      }),
    })
    expect(res.status).toBe(401)
  })
})

// ===== 首用户自动成为 admin 测试 =====

describe('首用户自动成为 admin', () => {
  it('在空数据库中注册的第一个用户角色为 admin', async () => {
    // 创建全新的空数据库
    const { db, sqlite } = createTestDb()
    // 清空 users 表，模拟全新环境
    sqlite.run('DELETE FROM users')

    const testApp = new Hono()
    testApp.onError((err, c) => {
      if (err instanceof SyntaxError) {
        return c.json({ error: '请求体 JSON 格式错误' }, 400)
      }
      return c.json({ error: err.message || '服务器内部错误' }, 500)
    })
    const app = testApp.route('/api/auth', createAuthRoutes({ db }))

    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'first@example.com', username: 'firstuser', password: 'password123' }),
    })
    expect(res.status).toBe(201)
    const data = await json(res)
    expect((data.user as Record<string, unknown>).role).toBe('admin')
  })
})
