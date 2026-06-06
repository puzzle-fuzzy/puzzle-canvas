/**
 * 文件上传路由模块
 *
 * 支持两种上传方式：
 *   1. 分片上传（大文件）— init → chunk → complete / cancel，支持断点续传
 *   2. 简单上传（小文件）— 单次 POST 直接上传
 *
 * 分片上传流程：
 *   POST   /init      — 初始化上传会话，返回 uploadId 和已有分片列表
 *   PUT    /chunk      — 上传单个分片（FormData）
 *   POST   /complete   — 校验并合并所有分片为最终文件
 *   DELETE /cancel     — 取消上传，清理临时分片
 *
 * 简单上传：
 *   POST   /            — 单文件直接上传（FormData）
 *
 * 通过 createUploadRoutes() 返回类型化的 Hono 子路由，
 * 在 server/index.ts 中以 app.route('/api/upload', ...) 挂载。
 */
import { Hono } from 'hono'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import {
  isDangerousFile,
  isValidFingerprint,
  isSafeFileName,
  MAX_FILE_SIZE,
  MAX_CHUNK_SIZE,
  CHUNK_DIR,
  uploadSessions,
} from '../utils/upload'

/** 认证中间件类型 */
type AuthMiddleware = (c: import('hono').Context, next: import('hono').Next) => Promise<Response | void>

/** 路由依赖注入接口 */
interface UploadRouteDeps {
  auth?: AuthMiddleware
}

export function createUploadRoutes(deps: UploadRouteDeps = {}) {
  const router = new Hono()

  // 应用认证中间件（如果提供）
  if (deps.auth) {
    router.use('*', deps.auth)
  }

  return router
    // ===== 分片上传：初始化 =====
    .post('/init', async (c) => {
      const body = await c.req.json()
      const { fileName, fileSize, totalChunks, fingerprint } = body

      // 校验必填字段存在性
      if (!fileName || fileSize == null || totalChunks == null || !fingerprint) {
        return c.json({ error: '缺少必要字段 (fileName, fileSize, totalChunks, fingerprint)' }, 400)
      }

      // 校验文件名安全性
      if (!isSafeFileName(fileName)) {
        return c.json({ error: '文件名不合法' }, 400)
      }

      // 校验文件类型
      if (isDangerousFile(fileName)) {
        return c.json({ error: '不支持的文件类型' }, 400)
      }

      // 校验 fileSize 为非负数字
      if (typeof fileSize !== 'number' || isNaN(fileSize) || fileSize < 0) {
        return c.json({ error: 'fileSize 必须为非负数字' }, 400)
      }

      // 校验文件大小上限
      if (fileSize > MAX_FILE_SIZE) {
        return c.json({ error: '文件过大（最大 800MB）' }, 413)
      }

      // 校验 totalChunks 为正整数
      if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
        return c.json({ error: 'totalChunks 必须为正整数' }, 400)
      }

      // 校验 fingerprint 格式（仅允许 SHA-256 hex 字符，防止路径遍历）
      if (typeof fingerprint !== 'string' || !isValidFingerprint(fingerprint)) {
        return c.json({ error: 'fingerprint 格式无效' }, 400)
      }

      const uploadId = crypto.randomUUID()

      // 扫描已有分片，支持断点续传：客户端只需上传缺失的分片
      const chunkDir = `${CHUNK_DIR}/${fingerprint}`
      let existingChunks: number[] = []
      try {
        const entries = readdirSync(chunkDir)
        existingChunks = entries
          .filter((e) => e.startsWith('chunk-'))
          .map((e) => parseInt(e.slice(6), 10))
          .filter((n) => !isNaN(n))
      } catch { /* 目录不存在，首次上传 */ }

      mkdirSync(chunkDir, { recursive: true })

      // 在内存中记录上传会话
      uploadSessions.set(uploadId, {
        fingerprint,
        totalChunks,
        createdAt: Date.now(),
      })

      return c.json({ uploadId, existingChunks })
    })

    // ===== 分片上传：上传单个分片 =====
    .put('/chunk', async (c) => {
      const body = await c.req.parseBody()
      const uploadId = body['uploadId'] as string
      const chunkIndex = parseInt(body['chunkIndex'] as string, 10)
      const chunk = body['chunk']

      const session = uploadSessions.get(uploadId)
      if (!session) {
        return c.json({ error: '无效的 uploadId' }, 400)
      }
      if (!(chunk instanceof File)) {
        return c.json({ error: '未提供分片' }, 400)
      }

      // 校验单分片大小
      if (chunk.size > MAX_CHUNK_SIZE) {
        return c.json({ error: '分片大小超过限制（最大 100MB）' }, 413)
      }

      if (isNaN(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
        return c.json({ error: '无效的分片索引' }, 400)
      }

      // 将分片写入临时目录：uploads/tmp/{fingerprint}/chunk-{index}
      const chunkPath = `${CHUNK_DIR}/${session.fingerprint}/chunk-${chunkIndex}`
      await Bun.write(chunkPath, chunk)

      return c.json({ ok: true })
    })

    // ===== 分片上传：合并完成 =====
    .post('/complete', async (c) => {
      const body = await c.req.json()
      const { uploadId, fileName } = body

      const session = uploadSessions.get(uploadId)
      if (!session) {
        return c.json({ error: '无效的 uploadId' }, 400)
      }

      // 再次校验文件名（防止绕过 init 阶段）
      if (!fileName || typeof fileName !== 'string') {
        return c.json({ error: '缺少 fileName' }, 400)
      }
      if (!isSafeFileName(fileName)) {
        return c.json({ error: '文件名不合法' }, 400)
      }
      if (isDangerousFile(fileName)) {
        return c.json({ error: '不支持的文件类型' }, 400)
      }

      const chunkDir = `${CHUNK_DIR}/${session.fingerprint}`

      // 校验所有分片是否已齐全
      for (let i = 0; i < session.totalChunks; i++) {
        const chunkFile = Bun.file(`${chunkDir}/chunk-${i}`)
        if (!(await chunkFile.exists())) {
          return c.json({ error: `缺少分片 ${i}` }, 400)
        }
      }

      // 生成唯一文件名：时间戳 + 随机后缀 + 原始扩展名
      const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : ''
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
      const finalPath = `./uploads/${uniqueName}`

      // 按序拼接所有分片为最终文件
      const chunks: Buffer[] = []
      for (let i = 0; i < session.totalChunks; i++) {
        const buf = await Bun.file(`${chunkDir}/chunk-${i}`).arrayBuffer()
        chunks.push(Buffer.from(buf))
      }
      await Bun.write(finalPath, Buffer.concat(chunks))

      // 合并完成后清理临时分片目录
      try { rmSync(chunkDir, { recursive: true }) } catch { /* 清理失败不影响结果 */ }

      // 移除内存中的上传会话
      uploadSessions.delete(uploadId)

      // 根据扩展名推断媒体类型
      const mediaType = /\.(mp4|webm|mov|avi|mkv)$/i.test(fileName) ? 'video'
        : /\.(jpe?g|png|gif|webp|bmp|svg|ico|tiff?)$/i.test(fileName) ? 'image'
        : 'document'

      return c.json({
        src: `/uploads/${uniqueName}`,
        fileName,
        mediaType,
      })
    })

    // ===== 分片上传：取消 =====
    .delete('/cancel', async (c) => {
      const body = await c.req.json()
      const { uploadId } = body

      const session = uploadSessions.get(uploadId)
      if (!session) {
        return c.json({ error: '无效的 uploadId' }, 400)
      }

      // 删除临时分片目录并移除会话
      try { rmSync(`${CHUNK_DIR}/${session.fingerprint}`, { recursive: true }) } catch { /* 清理失败不影响结果 */ }
      uploadSessions.delete(uploadId)

      return c.json({ ok: true })
    })

    // ===== 简单上传（非分片，适合小文件） =====
    .post('/', async (c) => {
      const body = await c.req.parseBody()
      const file = body['file']

      if (!(file instanceof File)) {
        return c.json({ error: '未提供文件' }, 400)
      }

      if (isDangerousFile(file.name)) {
        return c.json({ error: '不支持的文件类型' }, 400)
      }

      if (file.size > MAX_FILE_SIZE) {
        return c.json({ error: '文件过大（最大 800MB）' }, 413)
      }

      // 生成唯一文件名并写入磁盘
      const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`

      await Bun.write(`./uploads/${uniqueName}`, file)

      // 根据 MIME 类型推断媒体类型
      const mediaType = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('video/') ? 'video'
        : 'document'

      return c.json({
        src: `/uploads/${uniqueName}`,
        fileName: file.name,
        mediaType,
      })
    })
}
