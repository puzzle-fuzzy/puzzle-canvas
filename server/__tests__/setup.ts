/**
 * 测试辅助模块
 *
 * 提供内存数据库和 Hono 应用实例的工厂函数，
 * 供各路由集成测试使用。
 */
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from '../db/schema'
import { registerNodeRoutes } from '../routes/nodes'
import { registerUploadRoutes } from '../routes/upload'
import { registerMetadataRoutes } from '../routes/metadata'
import { registerAIRoutes } from '../routes/ai'

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

  const db = drizzle(sqlite, { schema })
  return { db, sqlite }
}

/**
 * 创建测试用 Hono 应用实例
 *
 * 使用内存数据库，注册所有路由，支持依赖注入。
 * 返回 app 和 db 供测试用例使用。
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

  registerNodeRoutes(app, { db })
  registerUploadRoutes(app)
  registerMetadataRoutes(app)
  registerAIRoutes(app)

  return { app, db, sqlite }
}
