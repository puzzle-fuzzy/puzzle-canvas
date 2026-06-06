import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { db } from './db'
import { nodes } from './db/schema'
import { eq } from 'drizzle-orm'

// 确保上传目录存在
mkdirSync('./uploads', { recursive: true })
mkdirSync('./uploads/tmp', { recursive: true })

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}))

// 全局错误处理，确保错误响应也带 CORS 头
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ error: err.message || '服务器内部错误' }, 500)
})

// 静态文件服务：提供上传的文件
app.use('/uploads/*', serveStatic({ root: './' }))

// ========== 节点 CRUD ==========
const VALID_NODE_TYPES = ['urlNode', 'imageNode', 'videoNode', 'docNode']

// 获取所有节点
app.get('/api/nodes', (c) => {
  const allNodes = db.select().from(nodes).all()
  return c.json(allNodes)
})

// 创建节点
app.post('/api/nodes', async (c) => {
  const body = await c.req.json()

  if (!body.id || !body.type || body.positionX == null || body.positionY == null) {
    return c.json({ error: '缺少必要字段 (id, type, positionX, positionY)' }, 400)
  }

  if (!VALID_NODE_TYPES.includes(body.type)) {
    return c.json({ error: `无效的节点类型，允许: ${VALID_NODE_TYPES.join(', ')}` }, 400)
  }

  const result = db.insert(nodes).values({
    id: body.id,
    type: body.type,
    positionX: body.positionX,
    positionY: body.positionY,
    url: body.url ?? null,
    title: body.title ?? null,
    description: body.description ?? null,
    image: body.image ?? null,
    favicon: body.favicon ?? null,
    src: body.src ?? null,
    fileName: body.fileName ?? null,
    fileSize: body.fileSize ?? null,
  }).returning().get()

  return c.json(result, 201)
})

// 更新节点
app.patch('/api/nodes/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const allowedFields = ['positionX', 'positionY', 'title', 'description', 'image', 'favicon', 'src', 'fileName', 'fileSize']
  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: '没有可更新的字段' }, 400)
  }

  const result = db.update(nodes).set(updates).where(eq(nodes.id, id)).returning().get()
  if (!result) {
    return c.json({ error: '节点不存在' }, 404)
  }

  return c.json(result)
})

// 删除节点
app.delete('/api/nodes/:id', (c) => {
  const id = c.req.param('id')
  const result = db.delete(nodes).where(eq(nodes.id, id)).returning().get()
  if (!result) {
    return c.json({ error: '节点不存在' }, 404)
  }
  return c.body(null, 204)
})

// ========== 文件上传 ==========

// 危险文件扩展名黑名单
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'dll', 'sys', 'vxd',
  'vbs', 'vbe', 'wsf', 'wsh', 'ps1', 'psm1',
  'jar', 'class',
  'inf', 'reg', 'lnk', 'desktop',
  'app', 'dmg', 'pkg',
  'iso', 'img',
  'hta', 'cpl',
])

function isDangerousFile(fileName: string): boolean {
  const parts = fileName.toLowerCase().split('.')
  for (let i = 1; i < parts.length; i++) {
    if (DANGEROUS_EXTENSIONS.has(parts[i])) return true
  }
  return false
}

const MAX_FILE_SIZE = 800 * 1024 * 1024 // 800 MB
const CHUNK_DIR = './uploads/tmp'
const TMP_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 小时

// 分片上传会话（内存）
const uploadSessions = new Map<string, {
  fingerprint: string
  totalChunks: number
  createdAt: number
}>()

// 定时清理过期临时分片（每小时）
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
  } catch { /* ignore */ }
}, 60 * 60 * 1000)

// 分片上传：初始化
app.post('/api/upload/init', async (c) => {
  const body = await c.req.json()
  const { fileName, fileSize, totalChunks, fingerprint } = body

  if (!fileName || !fileSize || !totalChunks || !fingerprint) {
    return c.json({ error: '缺少必要字段' }, 400)
  }

  if (isDangerousFile(fileName)) {
    return c.json({ error: '不支持的文件类型' }, 400)
  }

  if (fileSize > MAX_FILE_SIZE) {
    return c.json({ error: '文件过大（最大 800MB）' }, 413)
  }

  const uploadId = crypto.randomUUID()

  // 扫描已有分片（用于断点续传）
  const chunkDir = `${CHUNK_DIR}/${fingerprint}`
  let existingChunks: number[] = []
  try {
    const entries = readdirSync(chunkDir)
    existingChunks = entries
      .filter((e) => e.startsWith('chunk-'))
      .map((e) => parseInt(e.slice(6), 10))
      .filter((n) => !isNaN(n))
  } catch { /* 目录不存在 */ }

  mkdirSync(chunkDir, { recursive: true })

  uploadSessions.set(uploadId, {
    fingerprint,
    totalChunks,
    createdAt: Date.now(),
  })

  return c.json({ uploadId, existingChunks })
})

// 分片上传：上传分片
app.put('/api/upload/chunk', async (c) => {
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
  if (isNaN(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    return c.json({ error: '无效的分片索引' }, 400)
  }

  const chunkPath = `${CHUNK_DIR}/${session.fingerprint}/chunk-${chunkIndex}`
  await Bun.write(chunkPath, chunk)

  return c.json({ ok: true })
})

// 分片上传：合并完成
app.post('/api/upload/complete', async (c) => {
  const body = await c.req.json()
  const { uploadId, fileName } = body

  const session = uploadSessions.get(uploadId)
  if (!session) {
    return c.json({ error: '无效的 uploadId' }, 400)
  }

  const chunkDir = `${CHUNK_DIR}/${session.fingerprint}`

  // 校验所有分片
  for (let i = 0; i < session.totalChunks; i++) {
    const chunkFile = Bun.file(`${chunkDir}/chunk-${i}`)
    if (!(await chunkFile.exists())) {
      return c.json({ error: `缺少分片 ${i}` }, 400)
    }
  }

  // 生成最终文件名
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : ''
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
  const finalPath = `./uploads/${uniqueName}`

  // 拼接所有分片
  const chunks: Buffer[] = []
  for (let i = 0; i < session.totalChunks; i++) {
    const buf = await Bun.file(`${chunkDir}/chunk-${i}`).arrayBuffer()
    chunks.push(Buffer.from(buf))
  }
  await Bun.write(finalPath, Buffer.concat(chunks))

  // 清理临时分片
  try { rmSync(chunkDir, { recursive: true }) } catch { /* ignore */ }

  uploadSessions.delete(uploadId)

  const mediaType = /\.(mp4|webm|mov|avi|mkv)$/i.test(fileName) ? 'video'
    : /\.(jpe?g|png|gif|webp|bmp|svg|ico|tiff?)$/i.test(fileName) ? 'image'
    : 'document'

  return c.json({
    src: `/uploads/${uniqueName}`,
    fileName,
    mediaType,
  })
})

// 分片上传：取消
app.delete('/api/upload/cancel', async (c) => {
  const body = await c.req.json()
  const { uploadId } = body

  const session = uploadSessions.get(uploadId)
  if (!session) {
    return c.json({ error: '无效的 uploadId' }, 400)
  }

  try { rmSync(`${CHUNK_DIR}/${session.fingerprint}`, { recursive: true }) } catch { /* ignore */ }
  uploadSessions.delete(uploadId)

  return c.json({ ok: true })
})

app.post('/api/upload', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!(file instanceof File)) {
    return c.json({ error: '未提供文件' }, 400)
  }

  // 校验危险文件
  if (isDangerousFile(file.name)) {
    return c.json({ error: '不支持的文件类型' }, 400)
  }

  // 校验文件大小
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: '文件过大（最大 800MB）' }, 413)
  }

  // 生成唯一文件名：时间戳 + 随机后缀 + 原始扩展名
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`

  // 写入磁盘
  await Bun.write(`./uploads/${uniqueName}`, file)

  const mediaType = file.type.startsWith('image/') ? 'image'
    : file.type.startsWith('video/') ? 'video'
    : 'document'

  return c.json({
    src: `/uploads/${uniqueName}`,
    fileName: file.name,
    mediaType,
  })
})

// ========== URL 元数据提取 ==========
function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta\\s+[^>]*(?:property|name)\\s*=\\s*["']${property}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, 'i'),
    new RegExp(`<meta\\s+[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${property}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return match[1]
  }
  return null
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match ? match[1].trim() : null
}

function extractFavicon(html: string, pageUrl: string): string | null {
  const patterns = [
    /<link\s+[^>]*rel\s*=\s*["'](?:shortcut\s+)?icon["'][^>]*href\s*=\s*["']([^"']+)["']/i,
    /<link\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["'](?:shortcut\s+)?icon["']/i,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      try {
        return new URL(match[1], pageUrl).href
      } catch {
        return match[1]
      }
    }
  }
  try {
    const url = new URL(pageUrl)
    return `${url.origin}/favicon.ico`
  } catch {
    return null
  }
}

app.get('/api/metadata', async (c) => {
  const url = c.req.query('url')

  if (!url) {
    return c.json({ error: '缺少 url 参数' }, 400)
  }

  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return c.json({ error: '仅支持 HTTP/HTTPS 协议' }, 400)
    }
  } catch {
    return c.json({ error: '无效的 URL' }, 400)
  }

  let html: string
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PuzzleCanvas/1.0; +https://github.com/puzzle-canvas)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10_000),
      redirect: 'follow',
    })
    if (!response.ok) {
      return c.json({ error: `目标网站返回 ${response.status}` }, 502)
    }
    html = await response.text()
  } catch (err) {
    const message = err instanceof Error ? err.message : '请求失败'
    return c.json({ error: `无法获取网页: ${message}` }, 502)
  }

  const title = extractMeta(html, 'og:title') ?? extractTitle(html) ?? new URL(url).hostname
  const description = extractMeta(html, 'og:description') ?? extractMeta(html, 'description') ?? ''
  const image = extractMeta(html, 'og:image')
  const favicon = extractFavicon(html, url)

  let resolvedImage = image
  if (image) {
    try {
      resolvedImage = new URL(image, url).href
    } catch {
      // 保持原样
    }
  }

  return c.json({
    url,
    title,
    description,
    image: resolvedImage ?? null,
    favicon,
  })
})

// ========== AI 生图（预留）==========
app.post('/api/generate-image', async (c) => {
  const body = await c.req.json()
  const { prompt, model } = body

  if (!prompt) {
    return c.json({ error: '缺少 prompt 参数' }, 400)
  }

  // TODO: 接入实际 AI 生图服务
  // 示例：调用 OpenAI DALL-E 3 API
  // const response = await fetch('https://api.openai.com/v1/images/generations', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  //   },
  //   body: JSON.stringify({
  //     model: model || 'dall-e-3',
  //     prompt,
  //     n: 1,
  //     size: '1024x1024',
  //   }),
  // })
  // const data = await response.json()
  // const imageUrl = data.data[0].url
  // 下载图片并保存到本地
  // const imgRes = await fetch(imageUrl)
  // const ext = 'png'
  // const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  // await Bun.write(`./uploads/${uniqueName}`, imgRes)
  // return c.json({ src: `/uploads/${uniqueName}`, prompt, model })

  return c.json({ error: 'AI 生图服务尚未配置' }, 501)
})

// ========== 前端产物静态服务（生产模式）==========
// 静态资源（JS/CSS/图片等）
app.use('/*', serveStatic({ root: './dist' }))

// SPA fallback：非 API/非静态资源请求返回 index.html
app.get('*', async (c) => {
  const file = Bun.file('./dist/index.html')
  if (await file.exists()) {
    return new Response(file)
  }
  return c.text('Frontend not built. Run `bun run build` first.', 404)
})

export default {
  port: 3001,
  fetch: app.fetch,
}
