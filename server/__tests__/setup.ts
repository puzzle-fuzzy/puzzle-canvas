/**
 * 测试辅助模块
 *
 * 提供内存数据库和类型化 Hono 应用实例的工厂函数，
 * 供各路由集成测试使用。
 *
 * 通过 app.route() 挂载子路由后，导出完整 app 类型，
 * 可用于 testClient<T> 实现端到端类型安全的测试。
 */
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from '../db/schema'
import { createAuthRoutes } from '../routes/auth'
import { createNodeRoutes } from '../routes/nodes'
import { createUploadRoutes } from '../routes/upload'
import { createMetadataRoutes } from '../routes/metadata'
import { createAIRoutes } from '../routes/ai'
import { createAuthMiddleware } from '../middleware/auth'
import { signAccessToken } from '../utils/auth'

/** 测试用固定用户信息 */
export const TEST_USER = {
  id: 'test-user-id',
  email: 'test@puzzle.local',
  username: 'tester',
} as const

/**
 * 创建测试用内存数据库
 *
 * 每次调用返回全新的 SQLite 内存实例，建好所有表结构，
 * 并插入一条测试用户记录（nodes 外键依赖）。
 */
export function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.run('PRAGMA foreign_keys = ON')

  // 建表
  sqlite.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      password_hash TEXT,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_login_at INTEGER
    )
  `)
  sqlite.run(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(provider, provider_account_id)
    )
  `)
  sqlite.run(`
    CREATE TABLE refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  sqlite.run(`
    CREATE TABLE nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      position_x REAL NOT NULL,
      position_y REAL NOT NULL,
      url TEXT,
      title TEXT,
      description TEXT,
      image TEXT,
      favicon TEXT,
      src TEXT,
      fileName TEXT,
      file_size INTEGER,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  // 插入测试用户（nodes 外键依赖）
  sqlite.run('INSERT INTO users (id, email, username) VALUES (?, ?, ?)', [
    TEST_USER.id,
    TEST_USER.email,
    TEST_USER.username,
  ])
  // 插入默认临时用户（与 routes/nodes.ts 中 userId 默认值 'temp' 对应）
  sqlite.run('INSERT INTO users (id, email, username) VALUES (?, ?, ?)', [
    'temp',
    'temp@puzzle.local',
    '临时用户',
  ])

  const db = drizzle(sqlite, { schema })
  return { db, sqlite }
}

/**
 * 创建测试用 Hono 应用实例（无认证，兼容旧测试）
 *
 * 使用内存数据库，通过 app.route() 挂载所有子路由，
 * 返回类型化的 app 供 testClient 使用。
 */
export function createTestApp() {
  const { db, sqlite } = createTestDb()

  const app = new Hono()

  // 全局错误处理（与生产一致）
  app.onError((err, c) => {
    if (err instanceof SyntaxError) {
      return c.json({ error: '请求体 JSON 格式错误' }, 400)
    }
    return c.json({ error: err.message || '服务器内部错误' }, 500)
  })

  // 挂载子路由（链式调用以保留类型信息）
  const fullApp = app
    .route('/api/auth', createAuthRoutes({ db }))
    .route('/api/nodes', createNodeRoutes({ db }))
    .route('/api/upload', createUploadRoutes())
    .route('/api/metadata', createMetadataRoutes())
    .route('/api/generate-image', createAIRoutes())

  return { app: fullApp, db, sqlite }
}

/**
 * 创建带认证的测试用 Hono 应用实例
 *
 * 与 createTestApp 类似，但 nodes 和 upload 路由应用了认证中间件。
 * 请求需携带 Authorization header。
 */
export function createAuthenticatedTestApp() {
  const { db, sqlite } = createTestDb()
  const auth = createAuthMiddleware({ db })

  const app = new Hono()

  // 全局错误处理（与生产一致）
  app.onError((err, c) => {
    if (err instanceof SyntaxError) {
      return c.json({ error: '请求体 JSON 格式错误' }, 400)
    }
    return c.json({ error: err.message || '服务器内部错误' }, 500)
  })

  const fullApp = app
    .route('/api/auth', createAuthRoutes({ db }))
    .route('/api/nodes', createNodeRoutes({ db, auth }))
    .route('/api/upload', createUploadRoutes({ auth }))
    .route('/api/metadata', createMetadataRoutes())
    .route('/api/generate-image', createAIRoutes())

  return { app: fullApp, db, sqlite }
}

/**
 * 生成测试用 Authorization header
 *
 * 签发一个有效的 access token 供带认证的测试使用。
 */
export function getAuthHeaders(userId: string = TEST_USER.id): Record<string, string> {
  const token = signAccessToken({ userId, email: TEST_USER.email })
  return { Authorization: `Bearer ${token}` }
}

/** 测试用完整 app 类型，供 testClient 泛型参数使用 */
export type TestApp = ReturnType<typeof createTestApp>['app']
