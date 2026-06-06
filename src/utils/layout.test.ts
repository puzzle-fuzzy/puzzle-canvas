import { describe, it, expect } from 'vitest'
import { localWaterfallLayout, selectionWaterfallLayout } from './layout'
import { NODE_WIDTH, GAP_X, GAP_Y } from './constants'
import type { AppNode } from '../types'

/** 创建模拟 AppNode */
function mockNode(
  id: string,
  opts: {
    x?: number
    y?: number
    type?: AppNode['type']
    width?: number
    height?: number
  } = {},
): AppNode {
  const { x = 0, y = 0, type = 'urlNode', width, height } = opts
  return {
    id,
    type,
    position: { x, y },
    data: {},
    ...(width && height ? { measured: { width, height } } : {}),
  } as AppNode
}

describe('localWaterfallLayout', () => {
  it('单节点放在原点', () => {
    const layout = localWaterfallLayout({ x: 0, y: 0 })
    const pos = layout.next(200)
    expect(pos).toEqual({ x: 0, y: 0 })
  })

  it('填满 3 列', () => {
    const layout = localWaterfallLayout({ x: 0, y: 0 })
    const stepX = NODE_WIDTH + GAP_X

    const pos0 = layout.next(200) // col 0
    const pos1 = layout.next(200) // col 1
    const pos2 = layout.next(200) // col 2

    expect(pos0.x).toBe(0)
    expect(pos1.x).toBe(stepX)
    expect(pos2.x).toBe(stepX * 2)
    // 第一行 y 都一样
    expect(pos0.y).toBe(pos1.y)
    expect(pos1.y).toBe(pos2.y)
  })

  it('第 4 个节点放到最短列', () => {
    const layout = localWaterfallLayout({ x: 0, y: 0 })
    layout.next(400) // col 0, 高 400
    layout.next(200) // col 1, 高 200
    layout.next(300) // col 2, 高 300

    // col 1 最短 (0 + 200 + GAP_Y = 236)
    const pos3 = layout.next(100)
    expect(pos3.x).toBe(NODE_WIDTH + GAP_X) // col 1
    expect(pos3.y).toBe(200 + GAP_Y)
  })

  it('非零原点偏移', () => {
    const layout = localWaterfallLayout({ x: 100, y: 50 })
    const pos = layout.next(200)
    expect(pos).toEqual({ x: 100, y: 50 })
  })

  it('高度 0 不死循环', () => {
    const layout = localWaterfallLayout({ x: 0, y: 0 })
    const pos = layout.next(0)
    expect(pos).toEqual({ x: 0, y: 0 })
    // next(0) 后 colTops[0] = 0 + 0 + GAP_Y = GAP_Y
    // 下一个节点找最短列（col 1 = 0 < col 0 = GAP_Y）
    const pos2 = layout.next(100)
    expect(pos2.x).toBe(NODE_WIDTH + GAP_X) // col 1
    expect(pos2.y).toBe(0) // col 1 的顶部
  })
})

describe('selectionWaterfallLayout', () => {
  it('空数组返回空 Map', () => {
    const result = selectionWaterfallLayout([])
    expect(result.size).toBe(0)
  })

  it('单个节点映射到包围盒原点', () => {
    const node = mockNode('a', { x: 100, y: 200, width: 320, height: 150 })
    const result = selectionWaterfallLayout([node])
    expect(result.has('a')).toBe(true)
    expect(result.get('a')).toEqual({ x: 100, y: 200 })
  })

  it('多节点按高度降序排列', () => {
    const nodes = [
      mockNode('short', { x: 0, y: 0, width: 320, height: 100 }),
      mockNode('tall', { x: 0, y: 0, width: 320, height: 500 }),
      mockNode('medium', { x: 0, y: 0, width: 320, height: 300 }),
    ]
    const result = selectionWaterfallLayout(nodes)
    expect(result.size).toBe(3)
  })

  it('无 measured 时使用默认尺寸', () => {
    const nodes = [
      mockNode('a', { x: 0, y: 0 }), // 无 measured
      mockNode('b', { x: 10, y: 10 }), // 无 measured
    ]
    const result = selectionWaterfallLayout(nodes)
    expect(result.size).toBe(2)
    // 所有无 measured 的节点使用默认 height=200，按降序排后顺序一样
  })

  it('返回的位置数量与输入节点一致', () => {
    const nodes = Array.from({ length: 7 }, (_, i) =>
      mockNode(`n${i}`, { x: i * 50, y: i * 30, width: 320, height: 100 + i * 50 }),
    )
    const result = selectionWaterfallLayout(nodes)
    expect(result.size).toBe(7)
    // 每个 id 都有对应位置
    for (const node of nodes) {
      expect(result.has(node.id)).toBe(true)
    }
  })
})
