import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getApiUrl, loadNodes } from './api'

// mock authStore 以隔离 authFetch 的依赖
vi.mock('../stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({ accessToken: 'test-token', setAccessToken: vi.fn() }),
  },
}))

describe('getApiUrl', () => {
  it('路径带前导斜杠', () => {
    const result = getApiUrl('/api/nodes')
    expect(result).toMatch(/^\/api\/nodes$/)
  })

  it('无前导斜杠时补上', () => {
    const result = getApiUrl('api/nodes')
    expect(result).toBe('/api/nodes')
  })
})

describe('loadNodes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('成功返回 urlNode', async () => {
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
      groupId: undefined,
    })
  })

  it('成功返回 imageNode/videoNode', async () => {
    const mockRows = [
      { id: '2', type: 'imageNode', positionX: 10, positionY: 20, src: '/img.png', fileName: 'img.png' },
      { id: '3', type: 'videoNode', positionX: 30, positionY: 40, src: '/vid.mp4', fileName: 'vid.mp4' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRows),
    }))

    const nodes = await loadNodes()
    expect(nodes).toHaveLength(2)
    expect(nodes[0].type).toBe('imageNode')
    expect((nodes[0].data as Record<string, unknown>).src).toBe('/img.png')
    expect(nodes[1].type).toBe('videoNode')
    expect((nodes[1].data as Record<string, unknown>).src).toBe('/vid.mp4')
  })

  it('成功返回 docNode', async () => {
    const mockRows = [
      { id: '4', type: 'docNode', positionX: 0, positionY: 0, src: '/doc.pdf', fileName: 'doc.pdf', fileSize: 1024 },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRows),
    }))

    const nodes = await loadNodes()
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('docNode')
    expect((nodes[0].data as Record<string, unknown>).fileSize).toBe(1024)
  })

  it('成功返回 groupNode，排在最前面', async () => {
    const mockRows = [
      { id: '10', type: 'urlNode', positionX: 0, positionY: 0, url: 'https://x.com', title: 'X' },
      { id: '20', type: 'groupNode', positionX: 0, positionY: 0, title: 'My Group', width: 500, height: 300 },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRows),
    }))

    const nodes = await loadNodes()
    expect(nodes).toHaveLength(2)
    // groupNode 排在最前
    expect(nodes[0].type).toBe('groupNode')
    expect(nodes[0].data).toEqual({ label: 'My Group', width: 500, height: 300 })
    expect(nodes[1].type).toBe('urlNode')
  })

  it('过滤掉缺少必要字段的无效行', async () => {
    const mockRows = [
      { id: '1', type: 'urlNode', positionX: 0, positionY: 0, url: 'https://ok.com', title: 'OK' },
      { id: '2' }, // 缺少 type, positionX, positionY
      { id: '3', type: 'urlNode' }, // 缺少 positionX/Y
      { type: 'urlNode', positionX: 0, positionY: 0 }, // 缺少 id
      { id: '', type: 'urlNode', positionX: 0, positionY: 0 }, // 空 id
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRows),
    }))

    const nodes = await loadNodes()
    // 只有第一行通过校验
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('1')
  })

  it('后端返回非数组时返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: 'unexpected' }),
    }))

    const nodes = await loadNodes()
    expect(nodes).toEqual([])
  })

  it('非 OK 响应返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }))

    const nodes = await loadNodes()
    expect(nodes).toEqual([])
  })

  it('网络错误返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const nodes = await loadNodes()
    expect(nodes).toEqual([])
  })

  it('缺失可选字段时使用默认值', async () => {
    const mockRows = [
      { id: '1', type: 'urlNode', positionX: 0, positionY: 0 },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRows),
    }))

    const nodes = await loadNodes()
    expect(nodes[0].data).toEqual({
      url: '',
      title: '',
      description: '',
      image: null,
      favicon: null,
      groupId: undefined,
    })
  })
})
