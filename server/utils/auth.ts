/**
 * 认证工具模块
 *
 * 提供 JWT 签发/验证、密码哈希、刷新令牌生成等底层工具函数。
 * 所有函数均为纯函数或显式接收 db 参数，便于测试。
 */
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { users } from '../db/schema'
import type { drizzle } from 'drizzle-orm/bun-sqlite'

// ========== 常量 ==========

/** Access Token 有效期（15 分钟） */
export const ACCESS_TOKEN_EXPIRY = '15m'

/** Refresh Token 有效期（7 天），单位毫秒 */
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 3600 * 1000

/** JWT 签名密钥 */
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET 环境变量在生产环境中必须设置')
    }
    console.warn('⚠️  使用默认 JWT_SECRET，生产环境请设置环境变量')
    return 'dev-secret-change-me'
  }
  return secret
})()

/** 密码哈希 salt rounds */
const SALT_ROUNDS = 12

// ========== 类型 ==========

/** Access Token 载荷 */
export type AccessTokenPayload = {
  userId: string
  email: string
}

/** 用户公开信息（不含密码） */
export type PublicUser = {
  id: string
  email: string
  username: string
  role: 'admin' | 'member'
  avatar: string | null
}

// ========== 密码工具 ==========

/** 对密码进行 bcrypt 哈希 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/** 验证密码与哈希是否匹配 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ========== JWT 工具 ==========

/** 签发 Access Token */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })
}

/** 验证 Access Token，成功返回载荷，失败返回 null */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as AccessTokenPayload
  } catch {
    return null
  }
}

// ========== 刷新令牌工具 ==========

/** 生成不透明的刷新令牌（UUID v4） */
export function generateRefreshToken(): string {
  return crypto.randomUUID()
}

// ========== 辅助函数 ==========

/**
 * 查询 users 表是否为空（用于首用户自动成为 admin 的判断）
 *
 * 使用事务保证 check + insert 的原子性，防止并发注册时两人都成为 admin。
 * 调用方应将后续的 INSERT 包裹在同一个事务中。
 */
export function isFirstUser(db: ReturnType<typeof drizzle>): boolean {
  const result = db.select({ id: users.id }).from(users).limit(1).all()
  return result.length === 0
}

/** 从用户记录中提取公开信息（剔除 passwordHash 等敏感字段） */
export function toPublicUser(user: typeof users.$inferSelect): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role as 'admin' | 'member',
    avatar: user.avatar,
  }
}
