/**
 * 节点 CRUD 路由集成测试
 *
 * 使用 hono/testing 的 testClient 进行类型安全的端到端测试，
 * 无需手动类型断言，响应体类型由路由定义自动推断。
 */
import { describe, it, expect } from 'bun:test'
import { testClient } from 'hono/testing'
import { createTestApp, type TestApp } from '../setup'

describe('节点路由', () => {
  const setup = () => {
    const { app } = createTestApp()
    return testClient<TestApp>(app)
  }

  // ===== GET /api/nodes =====

  describe('GET /api/nodes', () => {
    it('空列表返回 []', async () => {
      const client = setup()
      const res = await client.api.nodes.$get()
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('返回已创建的节点', async () => {
      const client = setup()
      await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'urlNode',
          positionX: 100,
          positionY: 200,
        },
      })

      const res = await client.api.nodes.$get()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].id).toBe('node-1')
    })
  })

  // ===== POST /api/nodes =====

  describe('POST /api/nodes', () => {
    it('正常创建节点', async () => {
      const client = setup()
      const res = await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'urlNode',
          positionX: 100,
          positionY: 200,
          url: 'https://example.com',
          title: 'Example',
        },
      })
      expect(res.status).toBe(201)
      const data = await res.json() as Record<string, any>
      expect(data.id).toBe('node-1')
      expect(data.type).toBe('urlNode')
      expect(data.positionX).toBe(100)
      expect(data.positionY).toBe(200)
      expect(data.url).toBe('https://example.com')
      expect(data.title).toBe('Example')
    })

    it('缺少 id 返回 400', async () => {
      const client = setup()
      const res = await client.api.nodes.$post({
        json: {
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        },
      })
      expect(res.status).toBe(400)
    })

    it('缺少 type 返回 400', async () => {
      const client = setup()
      const res = await client.api.nodes.$post({
        json: {
          id: 'node-1',
          positionX: 0,
          positionY: 0,
        },
      })
      expect(res.status).toBe(400)
    })

    it('缺少 positionX 返回 400', async () => {
      const client = setup()
      const res = await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'urlNode',
          positionY: 0,
        },
      })
      expect(res.status).toBe(400)
    })

    it('无效的节点类型返回 400', async () => {
      const client = setup()
      const res = await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'invalidType',
          positionX: 0,
          positionY: 0,
        },
      })
      expect(res.status).toBe(400)
      const data = await res.json() as Record<string, any>
      expect(data.error).toContain('无效的节点类型')
    })

    it('positionX 为字符串返回 400', async () => {
      const client = setup()
      const res = await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'urlNode',
          positionX: 'abc' as unknown as number,
          positionY: 0,
        },
      })
      expect(res.status).toBe(400)
    })

    it('positionX 为 NaN 返回 400', async () => {
      const client = setup()
      const res = await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'urlNode',
          positionX: NaN,
          positionY: 0,
        },
      })
      expect(res.status).toBe(400)
    })

    it('malformed JSON 返回 400', async () => {
      const client = setup()
      const res = await client.api.nodes.$post({
        json: '{invalid json}' as unknown as Record<string, unknown>,
      })
      expect(res.status).toBe(400)
    })

    it('空 body 返回 400', async () => {
      const client = setup()
      const res = await client.api.nodes.$post({
        json: {} as Record<string, unknown>,
      })
      expect(res.status).toBe(400)
    })

    it('positionX 为 0 视为有效', async () => {
      const client = setup()
      const res = await client.api.nodes.$post({
        json: {
          id: 'node-zero',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        },
      })
      expect(res.status).toBe(201)
    })
  })

  // ===== PATCH /api/nodes/:id =====

  describe('PATCH /api/nodes/:id', () => {
    it('正常更新节点位置', async () => {
      const client = setup()
      await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        },
      })

      const res = await client.api.nodes[':id'].$patch({
        param: { id: 'node-1' },
        json: { positionX: 100, positionY: 200 },
      } as any)
      expect(res.status).toBe(200)
      const data = await res.json() as Record<string, any>
      expect(data.positionX).toBe(100)
      expect(data.positionY).toBe(200)
    })

    it('更新 title', async () => {
      const client = setup()
      await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        },
      })

      const res = await client.api.nodes[':id'].$patch({
        param: { id: 'node-1' },
        json: { title: '新标题' },
      } as any)
      expect(res.status).toBe(200)
      expect((await res.json() as Record<string, any>).title).toBe('新标题')
    })

    it('空更新返回 400', async () => {
      const client = setup()
      const res = await client.api.nodes[':id'].$patch({
        param: { id: 'nonexist' },
        json: {} as Record<string, unknown>,
      } as any)
      expect(res.status).toBe(400)
    })

    it('不存在的节点返回 404', async () => {
      const client = setup()
      const res = await client.api.nodes[':id'].$patch({
        param: { id: 'nonexist' },
        json: { title: 'test' },
      } as any)
      expect(res.status).toBe(404)
    })

    it('注入非法字段被过滤', async () => {
      const client = setup()
      await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        },
      })

      const res = await client.api.nodes[':id'].$patch({
        param: { id: 'node-1' },
        json: { positionX: 50, role: 'admin' } as unknown as Record<string, unknown>,
      } as any)
      expect(res.status).toBe(200)
      expect((await res.json() as Record<string, any>).positionX).toBe(50)
    })

    it('positionX 为字符串返回 400', async () => {
      const client = setup()
      await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        },
      })

      const res = await client.api.nodes[':id'].$patch({
        param: { id: 'node-1' },
        json: { positionX: 'not-a-number' } as unknown as Record<string, unknown>,
      } as any)
      expect(res.status).toBe(400)
    })

    it('title 为非字符串返回 400', async () => {
      const client = setup()
      await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        },
      })

      const res = await client.api.nodes[':id'].$patch({
        param: { id: 'node-1' },
        json: { title: 123 } as unknown as Record<string, unknown>,
      } as any)
      expect(res.status).toBe(400)
    })
  })

  // ===== DELETE /api/nodes/:id =====

  describe('DELETE /api/nodes/:id', () => {
    it('删除存在的节点返回 204', async () => {
      const client = setup()
      await client.api.nodes.$post({
        json: {
          id: 'node-1',
          type: 'urlNode',
          positionX: 0,
          positionY: 0,
        },
      })

      const res = await client.api.nodes[':id'].$delete({
        param: { id: 'node-1' },
      })
      expect(res.status).toBe(204)

      const list = await client.api.nodes.$get()
      expect(await list.json()).toEqual([])
    })

    it('删除不存在的节点返回 404', async () => {
      const client = setup()
      const res = await client.api.nodes[':id'].$delete({
        param: { id: 'nonexist' },
      })
      expect(res.status).toBe(404)
    })
  })
})
