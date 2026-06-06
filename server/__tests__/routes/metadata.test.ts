/**
 * 元数据辅助函数 + 路由集成测试
 *
 * 辅助函数部分为纯单元测试（不依赖 Hono），
 * 路由集成测试使用 hono/testing 的 testClient，
 * 无需手动类型断言。
 */
import { describe, it, expect } from 'bun:test'
import { testClient } from 'hono/testing'
import { createTestApp, type TestApp } from '../setup'
import {
  extractMeta,
  extractTitle,
  extractFavicon,
  isPrivateUrl,
} from '../../routes/metadata'

// ===== 辅助函数单元测试 =====

describe('extractMeta', () => {
  it('标准 OG 标签（property 在 content 前）', () => {
    const html = '<meta property="og:title" content="Hello">'
    expect(extractMeta(html, 'og:title')).toBe('Hello')
  })

  it('反序（content 在 property 前）', () => {
    const html = '<meta content="World" property="og:title">'
    expect(extractMeta(html, 'og:title')).toBe('World')
  })

  it('name 属性', () => {
    const html = '<meta name="description" content="A page">'
    expect(extractMeta(html, 'description')).toBe('A page')
  })

  it('无匹配返回 null', () => {
    const html = '<meta property="og:title" content="X">'
    expect(extractMeta(html, 'og:image')).toBeNull()
  })

  it('空 HTML 返回 null', () => {
    expect(extractMeta('', 'og:title')).toBeNull()
  })

  it('特殊字符 content（不解码 HTML 实体）', () => {
    const html = '<meta property="og:title" content="Hello &amp; World">'
    expect(extractMeta(html, 'og:title')).toBe('Hello &amp; World')
  })
})

describe('extractTitle', () => {
  it('标准 title 标签', () => {
    const html = '<title>My Page</title>'
    expect(extractTitle(html)).toBe('My Page')
  })

  it('title 含属性', () => {
    const html = '<title lang="en">My Page</title>'
    expect(extractTitle(html)).toBe('My Page')
  })

  it('空 title 返回 null', () => {
    const html = '<title></title>'
    expect(extractTitle(html)).toBeNull()
  })

  it('无 title 返回 null', () => {
    const html = '<html></html>'
    expect(extractTitle(html)).toBeNull()
  })

  it('含空白的 title 会被 trim 并返回 null', () => {
    const html = '<title>   </title>'
    expect(extractTitle(html)).toBeNull()
  })

  it('title 含子标签时去除标签保留纯文本', () => {
    const html = '<title>My <b>Page</b></title>'
    expect(extractTitle(html)).toBe('My Page')
  })
})

describe('extractFavicon', () => {
  it('标准 icon 标签', () => {
    const html = '<link rel="icon" href="/fav.png">'
    expect(extractFavicon(html, 'https://example.com/page')).toBe('https://example.com/fav.png')
  })

  it('shortcut icon 标签', () => {
    const html = '<link rel="shortcut icon" href="/favicon.ico">'
    expect(extractFavicon(html, 'https://example.com/')).toBe('https://example.com/favicon.ico')
  })

  it('href 在 rel 前的写法', () => {
    const html = '<link href="/icon.png" rel="icon">'
    expect(extractFavicon(html, 'https://example.com/')).toBe('https://example.com/icon.png')
  })

  it('无 favicon 标签时回退到 /favicon.ico', () => {
    expect(extractFavicon('<html></html>', 'https://example.com/page')).toBe('https://example.com/favicon.ico')
  })

  it('绝对路径 href', () => {
    const html = '<link rel="icon" href="https://cdn.example.com/fav.ico">'
    expect(extractFavicon(html, 'https://example.com/')).toBe('https://cdn.example.com/fav.ico')
  })

  it('无效 pageUrl 返回 null', () => {
    expect(extractFavicon('<html></html>', 'not-a-url')).toBeNull()
  })
})

describe('isPrivateUrl', () => {
  it('拦截 localhost', () => {
    expect(isPrivateUrl(new URL('http://localhost:3000/api/nodes'))).toBe(true)
  })

  it('拦截 127.0.0.1', () => {
    expect(isPrivateUrl(new URL('http://127.0.0.1/api'))).toBe(true)
  })

  it('拦截 10.x.x.x（A 类私有）', () => {
    expect(isPrivateUrl(new URL('http://10.0.0.1/secret'))).toBe(true)
    expect(isPrivateUrl(new URL('http://10.255.255.255/secret'))).toBe(true)
  })

  it('拦截 172.16-31.x.x（B 类私有）', () => {
    expect(isPrivateUrl(new URL('http://172.16.0.1/secret'))).toBe(true)
    expect(isPrivateUrl(new URL('http://172.31.255.255/secret'))).toBe(true)
  })

  it('172.32.x.x 不是私有地址', () => {
    expect(isPrivateUrl(new URL('http://172.32.0.1/page'))).toBe(false)
  })

  it('拦截 192.168.x.x（C 类私有）', () => {
    expect(isPrivateUrl(new URL('http://192.168.1.1/secret'))).toBe(true)
  })

  it('拦截 169.254.x.x（链路本地）', () => {
    expect(isPrivateUrl(new URL('http://169.254.169.254/metadata'))).toBe(true)
  })

  it('拦截 0.0.0.0', () => {
    expect(isPrivateUrl(new URL('http://0.0.0.0/api'))).toBe(true)
  })

  it('拦截 IPv6 唯一本地地址', () => {
    expect(isPrivateUrl(new URL('http://[fc00::1]/'))).toBe(true)
    expect(isPrivateUrl(new URL('http://[fd12:3456::1]/'))).toBe(true)
  })

  it('公网 IP 不拦截', () => {
    expect(isPrivateUrl(new URL('http://8.8.8.8/dns'))).toBe(false)
    expect(isPrivateUrl(new URL('http://1.1.1.1/'))).toBe(false)
    expect(isPrivateUrl(new URL('https://example.com/'))).toBe(false)
  })
})

// ===== 路由集成测试 =====

describe('GET /api/metadata', () => {
  const setup = () => {
    const { app } = createTestApp()
    return testClient<TestApp>(app)
  }

  it('缺少 url 参数返回 400', async () => {
    const client = setup()
    const res = await client.api.metadata.$get({
      query: {} as { url: string },
    })
    expect(res.status).toBe(400)
  })

  it('无效 URL 返回 400', async () => {
    const client = setup()
    const res = await client.api.metadata.$get({
      query: { url: 'not-a-url' },
    })
    expect(res.status).toBe(400)
  })

  it('非 HTTP 协议返回 400', async () => {
    const client = setup()
    const res = await client.api.metadata.$get({
      query: { url: 'ftp://example.com' },
    })
    expect(res.status).toBe(400)
  })

  it('SSRF 私有 IP 被拦截', async () => {
    const client = setup()
    const res = await client.api.metadata.$get({
      query: { url: 'http://192.168.1.1' },
    })
    expect(res.status).toBe(400)
    const data = await res.json() as Record<string, any>
    expect(data.error).toContain('私有网络')
  })

  it('SSRF localhost 被拦截', async () => {
    const client = setup()
    const res = await client.api.metadata.$get({
      query: { url: 'http://localhost:3001/api/nodes' },
    })
    expect(res.status).toBe(400)
  })

  it('SSRF 169.254 被拦截', async () => {
    const client = setup()
    const res = await client.api.metadata.$get({
      query: { url: 'http://169.254.169.254/latest/meta-data/' },
    })
    expect(res.status).toBe(400)
  })
})
