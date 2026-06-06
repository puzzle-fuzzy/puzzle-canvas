/**
 * 上传工具模块
 *
 * 提供文件上传所需的常量、校验函数、会话管理和临时文件清理。
 * 模块加载时会自动创建上传目录并启动定时清理任务。
 */
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'

// 启动时确保上传目录存在
mkdirSync('./uploads', { recursive: true })
mkdirSync('./uploads/tmp', { recursive: true })

/**
 * 危险文件扩展名黑名单
 *
 * 包含可直接执行或危害系统的文件类型，
 * 涵盖 Windows / macOS / Linux 平台的可执行文件、脚本、快捷方式等。
 * 采用多段检测（如 .tar.gz 也会被检测到 .gz 段）。
 */
export const DANGEROUS_EXTENSIONS = new Set([
  // Windows 可执行文件
  'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'dll', 'sys', 'vxd',
  // 脚本文件
  'vbs', 'vbe', 'wsf', 'wsh', 'ps1', 'psm1',
  // Java
  'jar', 'class',
  // 系统配置 / 快捷方式
  'inf', 'reg', 'lnk', 'desktop',
  // macOS 安装包 / 磁盘映像
  'app', 'dmg', 'pkg',
  // 磁盘映像
  'iso', 'img',
  // 其他
  'hta', 'cpl',
])

/** 文件大小上限：800 MB */
export const MAX_FILE_SIZE = 800 * 1024 * 1024

/** 分片临时存放目录 */
export const CHUNK_DIR = './uploads/tmp'

/** 临时分片最大保留时间：24 小时 */
export const TMP_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** 上传会话最大保留时间：1 小时（防止内存泄漏） */
export const SESSION_MAX_AGE_MS = 60 * 60 * 1000

/** 单个分片大小上限：100 MB */
export const MAX_CHUNK_SIZE = 100 * 1024 * 1024

/**
 * 判断文件名是否属于危险类型
 *
 * 对文件名所有扩展名段逐一检查，任一段命中黑名单即视为危险。
 * 例：`foo.exe`、`archive.tar.gz`（检测 .gz）都会被拦截。
 */
export function isDangerousFile(fileName: string): boolean {
  const parts = fileName.toLowerCase().split('.')
  for (let i = 1; i < parts.length; i++) {
    if (DANGEROUS_EXTENSIONS.has(parts[i])) return true
  }
  return false
}

/**
 * 校验 fingerprint 是否合法（仅允许 SHA-256 hex 字符）
 *
 * 防止路径遍历攻击：fingerprint 被用于拼接到文件路径中，
 * 必须确保不含 / \ . \x00 等危险字符。
 */
export function isValidFingerprint(fingerprint: string): boolean {
  return /^[0-9a-f]{1,128}$/.test(fingerprint)
}

/**
 * 校验文件名是否安全（不含路径分隔符或空字节）
 */
export function isSafeFileName(fileName: string): boolean {
  return typeof fileName === 'string'
    && fileName.length > 0
    && !fileName.includes('/')
    && !fileName.includes('\\')
    && !fileName.includes('\x00')
}

/**
 * 分片上传会话（内存存储）
 *
 * Key: uploadId（由 /api/upload/init 生成的 UUID）
 * Value: 文件指纹（SHA-256）、总分片数、创建时间
 */
export const uploadSessions = new Map<string, {
  fingerprint: string
  totalChunks: number
  createdAt: number
}>()

/**
 * 定时清理过期临时分片和上传会话
 *
 * 每小时扫描一次 CHUNK_DIR，删除超过 TMP_MAX_AGE_MS 的分片目录，
 * 同时清理超过 SESSION_MAX_AGE_MS 的内存会话，防止内存泄漏。
 */
setInterval(() => {
  try {
    const entries = readdirSync(CHUNK_DIR, { withFileTypes: true })
    const now = Date.now()
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = `${CHUNK_DIR}/${entry.name}`
        const stat = statSync(dirPath)
        if (now - stat.mtimeMs > TMP_MAX_AGE_MS) {
          rmSync(dirPath, { recursive: true })
        }
      }
    }
  } catch { /* 目录可能已被删除 */ }

  // 清理过期的上传会话（防止内存泄漏）
  const sessionNow = Date.now()
  for (const [id, session] of uploadSessions.entries()) {
    if (sessionNow - session.createdAt > SESSION_MAX_AGE_MS) {
      uploadSessions.delete(id)
    }
  }
}, 60 * 60 * 1000)
