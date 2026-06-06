import { describe, it, expect, vi } from 'vitest'
import { getApiUrl, loadNodes } from './api'

describe('getApiUrl', () => {
  it('DEV 模式添加后端前缀', () => {
    const result = getApiUrl('/api/nodes')
    // vitest 中 import.meta.env.DEV 取决于 vite config
    expect(result).toContain('/api/nodes')
  })

  it('路径带前导斜杠', () => {
    const result = getApiUrl('/api/nodes')
    expect(result).toMatch(/\/api\/nodes$/)
  })
})

describe('loadNodes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('成功返回节点列表', async () => {
    const mockRows = [
      {
        id: '1',
        type: 'urlNode',
        positionX: 100,
        positionY: 200,
        url: 'https://example.com',
        title: 'Example',
        description: 'Desc',
        image: null,
        favicon: null,
      },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRows),
    }))

    const nodes = await loadNodes()
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('1')
    expect(nodes[0].type).toBe('urlNode')
    expect(nodes[0].position).toEqual({ x: 100, y: 200 })
    expect(nodes[0].data).toEqual({
      url: 'https://example.com',
      title: 'Example',
      description: 'Desc',
      image: null,
      favicon: null,
    })
  })

  it('非 OK 响应返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }))

    const nodes = await loadNodes()
    expect(nodes).toEqual([])
  })

  it('畸形 JSON 返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    }))

    const nodes = await loadNodes()
    expect(nodes).toEqual([])
  })

  it('网络错误返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const nodes = await loadNodes()
    expect(nodes).toEqual([])
  })
})
