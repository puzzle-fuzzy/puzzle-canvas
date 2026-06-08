/**
 * 数据库表结构定义
 *
 * 表概览：
 *   users          — 用户主表
 *   accounts       — 第三方账号关联（OAuth / 密码登录）
 *   refresh_tokens — JWT 刷新令牌（支持吊销）
 *   nodes          — 画布节点
 */
import { sqliteTable, text, integer, real, unique, index } from 'drizzle-orm/sqlite-core'

// ==================== 用户与认证 ====================

/**
 * 用户主表
 *
 * 首个注册用户自动成为 admin，后续用户为 member。
 * passwordHash 可为空（纯 OAuth 用户未设置密码的情况）。
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull(),
  passwordHash: text('password_hash'),
  avatar: text('avatar'),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  status: text('status', { enum: ['active', 'disabled'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
})

/**
 * 第三方账号关联表
 *
 * 采用多 provider 设计：一个用户可关联 GitHub、Google 等多个第三方账号。
 * provider = 'credentials' 时 providerAccountId 为用户邮箱。
 * OAuth token 存于此表便于后续调用第三方 API。
 */
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => ({
  providerUnique: unique().on(table.provider, table.providerAccountId),
}))

/**
 * JWT 刷新令牌表
 *
 * access_token 短期（15min）无状态不存储。
 * refresh_token 长期（7天）存数据库，支持主动吊销：
 *   - 用户登出时删除
 *   - 修改密码后全部失效
 *   - 管理员踢下线
 * 每次刷新时旋转 token（旧 token 失效，签发新 token）。
 */
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

/**
 * 节点分享表
 *
 * 用户选中节点后生成分享快照，返回短密钥供他人导入。
 * nodesSnapshot 存 JSON 字符串，结构为节点元数据数组。
 * GET /api/shares/:key 无需认证，方便跨团队导入。
 */
export const shares = sqliteTable('shares', {
  id: text('id').primaryKey(),
  shareKey: text('share_key').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  nodesSnapshot: text('nodes_snapshot').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => ({
  shareKeyIdx: index('shares_share_key_idx').on(table.shareKey),
  userIdIdx: index('shares_user_id_idx').on(table.userId),
}))

// ==================== 画布数据 ====================

/**
 * 画布节点表（多态）
 *
 * 所有节点类型（urlNode / imageNode / videoNode / docNode）共用一张表，
 * 通过 type 字段区分，不同类型使用不同的可空字段。
 * userId 关联创建该节点的用户，支持多用户数据隔离。
 */
export const nodes = sqliteTable('nodes', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['urlNode', 'imageNode', 'videoNode', 'docNode', 'textNode', 'groupNode'] }).notNull(),
  positionX: real('position_x').notNull(),
  positionY: real('position_y').notNull(),

  // urlNode 字段
  url: text('url'),
  title: text('title'),
  description: text('description'),
  image: text('image'),
  favicon: text('favicon'),

  // imageNode / videoNode / docNode 字段
  src: text('src'),
  fileName: text('fileName'),
  fileSize: integer('file_size'),

  // groupNode 字段
  groupId: text('group_id'),  // 成员节点所属小组 ID
  width: real('width'),       // 小组节点宽度
  height: real('height'),     // 小组节点高度

  // 所属用户（数据隔离）
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => ({
  userIdIdx: index('nodes_user_id_idx').on(table.userId),
}))
