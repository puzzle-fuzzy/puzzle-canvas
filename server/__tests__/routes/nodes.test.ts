/**
 * 节点 CRUD 路由集成测试
 */
import { describe, it, expect, beforeEach } from 'bun:test'
import { createTestApp } from '../setup'
import type { Hono } from 'hono'

/** 从响应中解析 JSON 并断言类型 */
const json = (res: Response) => res.json() as Promise<Record<string, unknown>>

/** 从响应中解析 JSON 数组 */
const jsonArray = (res: Response) => res.json() as Promise<Record<string, unknown>[]>

describe('节点路由', () => {
  let app: Hono

  beforeEach(() => {
    const test = createTestApp()
    app = test.app
  })

  // ===== GET /api/nodes =====

  describe('GET /api/nodes', () => {
    it('空列表返回 []', async () => {
      const res = await app.request('/api/nodes')
      expect(res.status).toBe(200)
      expect(await jsonArray(res)).toEqual([])
    })

    it('返回已创建的节点', async () => {
      await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'urlNode',
          positionX: 100,
          positionY: 200,
        }),
      })

      const res = await app.request('/api/nodes')
      expect(res.status).toBe(200)
      const data = await jsonArray(res)
      expect(data).toHaveLength(1)
      expect(data[0].id).toBe('node-1')
    })
  })

  // ===== POST /api/nodes =====

  describe('POST /api/nodes', () => {
    it('正常创建节点', async () => {
      const res = await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'urlNode',
          positionX: 100,
          positionY: 200,
          url: 'https://example.com',
          title: 'Example',
        }),
      })
      expect(res.status).toBe(201)
      const data = await json(res)
      expect(data.id).toBe('node-1')
      expect(data.type).toBe('urlNode')
      expect(data.positionX).toBe(100)
      expect(data.positionY).toBe(200)
      expect(data.url).toBe('https://example.com')
      expect(data.title).toBe('Example')
    })

    it('缺少 id 返回 400', async () => {
      const res = await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('缺少 type 返回 400', async () => {
      const res = await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          positionX: 0,
          positionY: 0,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('缺少 positionX 返回 400', async () => {
      const res = await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'urlNode',
          positionY: 0,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('无效的节点类型返回 400', async () => {
      const res = await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'invalidType',
          positionX: 0,
          positionY: 0,
        }),
      })
      expect(res.status).toBe(400)
      const data = await json(res)
      expect(data.error).toContain('无效的节点类型')
    })

    it('positionX 为字符串返回 400', async () => {
      const res = await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'urlNode',
          positionX: 'abc',
          positionY: 0,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('positionX 为 NaN 返回 400', async () => {
      const res = await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'urlNode',
          positionX: NaN,
          positionY: 0,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('malformed JSON 返回 400', async () => {
      const res = await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      })
      expect(res.status).toBe(400)
      const data = await json(res)
      expect(data.error).toContain('JSON')
    })

    it('空 body 返回 400', async () => {
      const res = await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      expect(res.status).toBe(400)
    })

    it('positionX 为 0 视为有效', async () => {
      const res = await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-zero',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        }),
      })
      expect(res.status).toBe(201)
    })
  })

  // ===== PATCH /api/nodes/:id =====

  describe('PATCH /api/nodes/:id', () => {
    it('正常更新节点位置', async () => {
      await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        }),
      })

      const res = await app.request('/api/nodes/node-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX: 100, positionY: 200 }),
      })
      expect(res.status).toBe(200)
      const data = await json(res)
      expect(data.positionX).toBe(100)
      expect(data.positionY).toBe(200)
    })

    it('更新 title', async () => {
      await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        }),
      })

      const res = await app.request('/api/nodes/node-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新标题' }),
      })
      expect(res.status).toBe(200)
      expect((await json(res)).title).toBe('新标题')
    })

    it('空更新返回 400', async () => {
      const res = await app.request('/api/nodes/nonexist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    it('不存在的节点返回 404', async () => {
      const res = await app.request('/api/nodes/nonexist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'test' }),
      })
      expect(res.status).toBe(404)
    })

    it('注入非法字段被过滤', async () => {
      await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        }),
      })

      const res = await app.request('/api/nodes/node-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX: 50, role: 'admin' }),
      })
      expect(res.status).toBe(200)
      expect((await json(res)).positionX).toBe(50)
    })

    it('positionX 为字符串返回 400', async () => {
      await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        }),
      })

      const res = await app.request('/api/nodes/node-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX: 'not-a-number' }),
      })
      expect(res.status).toBe(400)
    })

    it('title 为非字符串返回 400', async () => {
      await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        }),
      })

      const res = await app.request('/api/nodes/node-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 123 }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ===== DELETE /api/nodes/:id =====

  describe('DELETE /api/nodes/:id', () => {
    it('删除存在的节点返回 204', async () => {
      await app.request('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        }),
      })

      const res = await app.request('/api/nodes/node-1', { method: 'DELETE' })
      expect(res.status).toBe(204)

      const list = await app.request('/api/nodes')
      expect(await jsonArray(list)).toEqual([])
    })

    it('删除不存在的节点返回 404', async () => {
      const res = await app.request('/api/nodes/nonexist', { method: 'DELETE' })
      expect(res.status).toBe(404)
    })
  })
})
