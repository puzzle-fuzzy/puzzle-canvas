# 账号系统：数据库设计与数据迁移

## Context

项目当前是单用户无认证状态。需要设计完备的账号体系，为未来开源多用户和协作做准备。
认证方式：JWT（access_token + refresh_token），支持邮箱密码和 GitHub OAuth 登录。
首次启动时若无用户，前端展示注册页面创建首个管理员。

## 数据库设计

### 1. `users` 表 — 用户主表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | text | PK | UUID |
| email | text | UNIQUE, NOT NULL | 登录凭证 |
| username | text | NOT NULL | 显示名称 |
| passwordHash | text | nullable | Argon2 哈希，OAuth 用户可为空 |
| avatar | text | nullable | 头像 URL |
| role | text | NOT NULL, DEFAULT 'member' | 'admin' 或 'member' |
| status | text | NOT NULL, DEFAULT 'active' | 'active' 或 'disabled' |
| createdAt | integer | NOT NULL | 创建时间（timestamp） |
| updatedAt | integer | NOT NULL | 更新时间（timestamp） |
| lastLoginAt | integer | nullable | 最后登录时间 |

设计考量：
- `passwordHash` nullable：OAuth 用户（如 GitHub）可能没有设置密码，后续可补充
- `role`：首个注册用户自动为 admin，后续用户为 member；admin 可管理用户和设置
- `status`：disabled 状态的用户无法登录，用于管理员禁用账号

### 2. `accounts` 表 — 第三方账号关联

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | text | PK | UUID |
| userId | text | FK → users.id, NOT NULL | 所属用户 |
| provider | text | NOT NULL | 'github' / 'credentials' |
| providerAccountId | text | NOT NULL | 第三方平台的用户 ID |
| accessToken | text | nullable | OAuth access token（加密存储） |
| refreshToken | text | nullable | OAuth refresh token |
| tokenExpiresAt | integer | nullable | token 过期时间 |
| createdAt | integer | NOT NULL | 创建时间 |
| updatedAt | integer | NOT NULL | 更新时间 |

UNIQUE 约束：`(provider, providerAccountId)`

设计考量：
- 一个用户可以关联多个第三方账号（GitHub、Google 等）
- `credentials` 类型用于记录邮箱密码登录方式（providerAccountId = email）
- OAuth token 存储方便后续调用第三方 API（如 GitHub 用户信息）

### 3. `refresh_tokens` 表 — JWT 刷新令牌

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | text | PK | UUID |
| userId | text | FK → users.id, NOT NULL | 所属用户 |
| token | text | UNIQUE, NOT NULL | refresh_token 值 |
| expiresAt | integer | NOT NULL | 过期时间（timestamp） |
| createdAt | integer | NOT NULL | 创建时间 |

设计考量：
- JWT access_token 短期（15min），无状态无需存储
- refresh_token 长期（7天），存数据库支持主动吊销（登出、踢下线、改密码后失效）
- 每次 refresh 时可旋转 token（旧 token 失效，签发新 token），增强安全性

### 4. `nodes` 表变更

在现有 nodes 表新增：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| userId | text | FK → users.id, NOT NULL | 所属用户 |

所有现有节点的 userId 将手动迁移为首个管理员用户 ID。

## Drizzle Schema 定义

```ts
// server/db/schema.ts

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull(),
  passwordHash: text('password_hash'),
  avatar: text('avatar'),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  status: text('status', { enum: ['active', 'disabled'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  providerUnique: unique().on(table.provider, table.providerAccountId),
}))

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// nodes 表新增 userId 字段
export const nodes = sqliteTable('nodes', {
  // ... 现有字段不变 ...
  userId: text('user_id').notNull().references(() => users.id),
})
```

## 数据迁移策略

由于项目是初始阶段且只有自己使用，采用手动迁移：

1. **删除旧数据库** `puzzle-canvas.db`（或备份后删除）
2. 更新 `server/db/schema.ts` 添加新表
3. 执行 `bun run db:push` 重建所有表
4. 首次启动时通过注册页面创建管理员账号，所有新节点自动关联该用户

**不需要编写迁移脚本**：项目刚开始，数据量极少，直接重建数据库即可。

## 实施步骤

1. 安装依赖：`bcryptjs`（密码哈希）、`jsonwebtoken`（JWT 签发/验证）
2. 更新 `server/db/schema.ts` — 添加 users、accounts、refresh_tokens 表，nodes 表新增 userId
3. 删除旧 `puzzle-canvas.db`，执行 `bun run db:push` 重建
4. 验证 `bun run build` 编译通过

本次 PR 仅涉及数据库设计和 schema 变更，不包含认证路由和前端实现。

## 验证

1. `bun run db:push` — 成功创建 users、accounts、refresh_tokens 表
2. `bun run db:studio` — 在 Drizzle Studio 中确认表结构正确
3. `bun run build` — 前端编译通过（nodes 的 userId 变更需要同步更新后端路由）
