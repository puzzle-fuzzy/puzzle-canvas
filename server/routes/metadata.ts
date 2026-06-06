/**
 * URL 元数据提取路由模块
 *
 * 根据 URL 抓取网页 HTML，提取 OpenGraph 元数据和 favicon。
 *   GET /api/metadata?url=xxx
 *
 * 返回字段：url, title, description, image, favicon
 *
 * 安全措施：
 *   - SSRF 防护：拦截私有网络地址（localhost / 内网 IP）
 *   - 响应体大小限制：最大 1MB，防止大文件耗尽内存
 *   - 请求超时：10 秒
 */
import type { Hono } from 'hono'

/** 响应体大小上限：1 MB */
const MAX_HTML_SIZE = 1024 * 1024

/**
 * 检查 URL 是否指向私有网络地址
 *
 * 拦截 SSRF 攻击：禁止访问内网 IP、回环地址、链路本地地址等。
 */
export function isPrivateUrl(url: URL): boolean {
  const hostname = url.hostname

  // 回环地址
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true
  }

  // 解析 IPv4 地址
  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number)
    if (a === 10) return true                    // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true  // 172.16.0.0/12
    if (a === 192 && b === 168) return true       // 192.168.0.0/16
    if (a === 0) return true                      // 0.0.0.0/8
    if (a === 127) return true                    // 127.0.0.0/8
    if (a === 169 && b === 254) return true       // 169.254.0.0/16（链路本地）
  }

  // IPv6 私有地址（简化检查：唯一本地地址 fc00::/7）
  // 注意：URL.hostname 对 IPv6 会带方括号，如 [fc00::1]
  const bareHost = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname
  if (bareHost.startsWith('fc') || bareHost.startsWith('fd') || bareHost === '::1') {
    return true
  }

  return false
}

/**
 * 从 HTML 中提取 <meta> 标签内容
 *
 * 兼容 property/name 在 content 前后两种写法：
 *   <meta property="og:title" content="xxx">
 *   <meta content="xxx" property="og:title">
 */
export function extractMeta(html: string, property: string): string | null {
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

/**
 * 从 HTML 中提取 <title> 标签文本
 *
 * 使用非贪婪匹配 .*? 以兼容 title 含子标签的情况：
 *   <title>My <b>Page</b></title> → "My <b>Page</b>"
 * 最终会去除 HTML 标签只保留文本。
 */
export function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i)
  if (!match) return null
  // 去除可能的子标签，只保留纯文本
  const text = match[1].replace(/<[^>]+>/g, '').trim()
  return text.length > 0 ? text : null
}

/**
 * 从 HTML 中提取 favicon 地址
 *
 * 查找 <link rel="icon"> 标签，未找到则回退到 /favicon.ico。
 * 相对路径会基于 pageUrl 解析为绝对路径。
 */
export function extractFavicon(html: string, pageUrl: string): string | null {
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
    let parsed: URL
    try {
      parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return c.json({ error: '仅支持 HTTP/HTTPS 协议' }, 400)
      }
    } catch {
      return c.json({ error: '无效的 URL' }, 400)
    }

    // SSRF 防护：禁止访问私有网络地址
    if (isPrivateUrl(parsed)) {
      return c.json({ error: '不允许访问私有网络地址' }, 400)
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

      // 检查 Content-Length 是否超过限制
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength, 10) > MAX_HTML_SIZE) {
        return c.json({ error: '目标网页过大' }, 502)
      }

      html = await response.text()

      // 实际内容超过限制时截断
      if (html.length > MAX_HTML_SIZE) {
        html = html.slice(0, MAX_HTML_SIZE)
      }
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
