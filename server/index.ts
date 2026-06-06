import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { mkdirSync } from 'node:fs'
import { db } from './db'
import { nodes } from './db/schema'
import { eq } from 'drizzle-orm'

// 确保上传目录存在
mkdirSync('./uploads', { recursive: true })

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
const VALID_NODE_TYPES = ['urlNode', 'imageNode', 'videoNode']

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
  }).returning().get()

  return c.json(result, 201)
})

// 更新节点
app.patch('/api/nodes/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const allowedFields = ['positionX', 'positionY', 'title', 'description', 'image', 'favicon', 'src', 'fileName']
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
const ALLOWED_MIME_PREFIXES = ['image/', 'video/']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

app.post('/api/upload', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!(file instanceof File)) {
    return c.json({ error: '未提供文件' }, 400)
  }

  // 校验 MIME 类型
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
    return c.json({ error: '仅支持图片和视频文件' }, 400)
  }

  // 校验文件大小
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: '文件过大（最大 50MB）' }, 413)
  }

  // 生成唯一文件名：时间戳 + 随机后缀 + 原始扩展名
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`

  // 写入磁盘
  await Bun.write(`./uploads/${uniqueName}`, file)

  const mediaType = file.type.startsWith('image/') ? 'image' : 'video'

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

export default {
  port: 3001,
  fetch: app.fetch,
}
