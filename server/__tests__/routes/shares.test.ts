import { describe, it, expect } from 'bun:test'
import { createAuthenticatedTestApp, getAuthHeaders } from '../setup'

describe('分享路由', () => {
  const sampleNodes = [
    { type: 'urlNode', url: 'https://example.com', title: 'Example', description: 'A site' },
    { type: 'textNode', description: 'Hello world' },
  ]

  describe('POST /api/shares — 创建分享', () => {
    it('需要认证', async () => {
      const { app } = createAuthenticatedTestApp()
      const res = await app.fetch(new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: sampleNodes }),
      }))
      expect(res.status).toBe(401)
    })

    it('缺少 nodes 数组返回 400', async () => {
      const { app } = createAuthenticatedTestApp()
      const res = await app.fetch(new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({}),
      }))
      expect(res.status).toBe(400)
    })

    it('空 nodes 数组返回 400', async () => {
      const { app } = createAuthenticatedTestApp()
      const res = await app.fetch(new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ nodes: [] }),
      }))
      expect(res.status).toBe(400)
    })

    it('节点缺少 type 字段返回 400', async () => {
      const { app } = createAuthenticatedTestApp()
      const res = await app.fetch(new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ nodes: [{ url: 'test' }] }),
      }))
      expect(res.status).toBe(400)
    })

    it('正常创建分享返回 shareKey', async () => {
      const { app } = createAuthenticatedTestApp()
      const res = await app.fetch(new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ nodes: sampleNodes }),
      }))
      expect(res.status).toBe(201)
      const data = await res.json() as { shareKey: string }
      expect(typeof data.shareKey).toBe('string')
      expect(data.shareKey).toHaveLength(8)
    })
  })

  describe('GET /api/shares/:key — 查询分享', () => {
    it('不存在的密钥返回 404', async () => {
      const { app } = createAuthenticatedTestApp()
      const res = await app.fetch(new Request('http://localhost/api/shares/deadbeef'))
      expect(res.status).toBe(404)
    })

    it('无效密钥（过长）返回 400', async () => {
      const { app } = createAuthenticatedTestApp()
      const res = await app.fetch(new Request('http://localhost/api/shares/this-is-way-too-long'))
      expect(res.status).toBe(400)
    })

    it('查询已创建的分享返回节点数据', async () => {
      const { app } = createAuthenticatedTestApp()

      // 创建分享
      const createRes = await app.fetch(new Request('http://localhost/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ nodes: sampleNodes }),
      }))
      expect(createRes.status).toBe(201)
      const { shareKey } = await createRes.json() as { shareKey: string }

      // 查询分享（不带认证 header，验证公开访问）
      const getRes = await app.fetch(new Request(`http://localhost/api/shares/${shareKey}`))
      expect(getRes.status).toBe(200)
      const data = await getRes.json() as { nodes: unknown[], createdAt: number }
      expect(data.nodes).toHaveLength(2)
      expect(data.createdAt).toBeDefined()
    })
  })
})