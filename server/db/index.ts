/**
 * 数据库连接模块
 *
 * 使用 Drizzle ORM + Bun SQLite 驱动。
 * 导出 createDb() 工厂函数供测试环境注入内存数据库，
 * 同时导出生产默认实例供业务代码直接使用。
 */
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'

/**
 * 创建 Drizzle 数据库实例
 *
 * @param dbPath 数据库文件路径，默认 'puzzle-canvas.db'；测试环境可传 ':memory:'
 */
export function createDb(dbPath = 'puzzle-canvas.db') {
  const sqlite = new Database(dbPath)
  sqlite.run('PRAGMA journal_mode = WAL;')
  sqlite.run('PRAGMA foreign_keys = ON;')
  return { db: drizzle(sqlite, { schema }), sqlite }
}

/** 生产环境默认数据库实例 */
export const { db, sqlite } = createDb()
