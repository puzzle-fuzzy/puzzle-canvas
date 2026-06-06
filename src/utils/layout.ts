import type { AppNode } from '../types'
import { NODE_WIDTH, GAP_X, GAP_Y, COL_COUNT } from './constants'

/**
 * 局部瀑布流布局生成器
 * 给定起始坐标，每次调用 next(height) 传入实际节点高度
 * 在起始点附近按 3 列瀑布流排列，互不重叠
 */
export function localWaterfallLayout(origin: { x: number; y: number }) {
  const stepX = NODE_WIDTH + GAP_X
  const colTops: number[] = new Array(COL_COUNT).fill(origin.y)

  return {
    next(height: number): { x: number; y: number } {
      let minCol = 0
      for (let i = 1; i < COL_COUNT; i++) {
        if (colTops[i] < colTops[minCol]) minCol = i
      }
      const pos = {
        x: origin.x + minCol * stepX,
        y: colTops[minCol],
      }
      colTops[minCol] += height + GAP_Y
      return pos
    },
  }
}

/**
 * 选区瀑布流布局
 * 给定一组已选节点，以它们包围盒左上角为原点
 * 按 3 列 masonry 排列，返回每个节点的新位置
 */
export function selectionWaterfallLayout(
  nodes: AppNode[],
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>()
  if (nodes.length === 0) return result

  // 包围盒左上角作为起点
  const minX = Math.min(...nodes.map((n) => n.position.x))
  const minY = Math.min(...nodes.map((n) => n.position.y))

  // 获取节点默认尺寸（所有节点宽度统一 320px）
  const defaultSize = (n: AppNode) => {
    if (n.measured?.width && n.measured?.height) {
      return { width: n.measured.width, height: n.measured.height }
    }
    return { width: NODE_WIDTH, height: 200 }
  }

  // 按高度降序排列，让大块先放，布局更紧凑
  const sorted = [...nodes].sort((a, b) => {
    const hA = defaultSize(a).height
    const hB = defaultSize(b).height
    return hB - hA
  })

  // 列宽取最宽节点
  const maxWidth = Math.max(...nodes.map((n) => defaultSize(n).width))
  const colStep = maxWidth + GAP_X
  const colTops: number[] = new Array(COL_COUNT).fill(minY)

  for (const node of sorted) {
    const { height } = defaultSize(node)

    // 找最短列
    let minCol = 0
    for (let i = 1; i < COL_COUNT; i++) {
      if (colTops[i] < colTops[minCol]) minCol = i
    }

    result.set(node.id, {
      x: minX + minCol * colStep,
      y: colTops[minCol],
    })
    colTops[minCol] += height + GAP_Y
  }

  return result
}
