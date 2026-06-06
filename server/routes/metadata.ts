/**
 * URL 元数据提取路由模块
 *
 * 根据 URL 抓取网页 HTML，提取 OpenGraph 元数据和 favicon。
 *   GET /api/metadata?url=xxx
 *
 * 返回字段：url, title, description, image, favicon
 */
import type { Hono } from 'hono'

/**
 * 从 HTML 中提取 <meta> 标签内容
 *
 * 兼容 property/name 在 content 前后两种写法：
 *   <meta property="og:title" content="xxx">
 *   <meta content="xxx" property="og:title">
 */
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

/** 从 HTML 中提取 <title> 标签文本 */
function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match ? match[1].trim() : null
}

/**
 * 从 HTML 中提取 favicon 地址
 *
 * 查找 <link rel="icon"> 标签，未找到则回退到 /favicon.ico。
 * 相对路径会基于 pageUrl 解析为绝对路径。
 */
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
  // 回退：使用网站根目录的 favicon.ico
  try {
    const url = new URL(pageUrl)
    return `${url.origin}/favicon.ico`
  } catch {
    return null
  }
}

export function registerMetadataRoutes(app: Hono) {
  app.get('/api/metadata', async (c) => {
    const url = c.req.query('url')

    if (!url) {
      return c.json({ error: '缺少 url 参数' }, 400)
    }

    // 仅允许 HTTP/HTTPS 协议
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return c.json({ error: '仅支持 HTTP/HTTPS 协议' }, 400)
      }
    } catch {
      return c.json({ error: '无效的 URL' }, 400)
    }

    // 抓取目标网页，超时 10 秒
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

    // 按优先级提取元数据：OpenGraph > HTML 原生标签 > 回退值
    const title = extractMeta(html, 'og:title') ?? extractTitle(html) ?? new URL(url).hostname
    const description = extractMeta(html, 'og:description') ?? extractMeta(html, 'description') ?? ''
    const image = extractMeta(html, 'og:image')
    const favicon = extractFavicon(html, url)

    // 将相对路径的图片地址解析为绝对路径
    let resolvedImage = image
    if (image) {
      try {
        resolvedImage = new URL(image, url).href
      } catch {
        // URL 解析失败，保持原样
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
}
