import { useMemo, useRef } from 'react'
import { useStore } from '@xyflow/react'
import { useCanvasStore } from '../stores/canvasStore'
import { NODE_WIDTH } from '../utils'

interface SelectedNodePos {
  id: string
  x: number
  y: number
  width: number | undefined
}

/**
 * 从 nodes 中提取选中节点的位置和尺寸信息
 * 返回排序后的快照，用于浅比较判断是否变化
 */
function extractSelectedPositions(
  nodes: ReturnType<typeof useCanvasStore.getState>['nodes'],
  ids: string[],
): SelectedNodePos[] {
  const idSet = ids.length > 10 ? new Set(ids) : null
  const result: SelectedNodePos[] = []
  for (const n of nodes) {
    if (idSet ? idSet.has(n.id) : ids.includes(n.id)) {
      result.push({ id: n.id, x: n.position.x, y: n.position.y, width: n.measured?.width })
    }
  }
  result.sort((a, b) => a.id.localeCompare(b.id))
  return result
}

/** 浅比较两个 SelectedNodePos 数组 */
function shallowEqualPositions(a: SelectedNodePos[], b: SelectedNodePos[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].x !== b[i].x || a[i].y !== b[i].y || a[i].width !== b[i].width) {
      return false
    }
  }
  return true
}

/**
 * 计算选区浮动工具栏的位置
 * 返回 null 表示无选中或不可见
 *
 * 优化：只在选中节点的位置/尺寸真正变化时才触发重渲染，
 * 而不是任何节点位置变化都触发。
 */
export function useSelectionToolbar() {
  // 用缓存避免非选中节点变化触发重渲染
  const cacheRef = useRef<SelectedNodePos[]>([])
  const selectedPositions = useCanvasStore((s) => {
    const newPos = extractSelectedPositions(s.nodes, s.selectedNodeIds)
    if (shallowEqualPositions(newPos, cacheRef.current)) {
      return cacheRef.current
    }
    cacheRef.current = newPos
    return newPos
  })

  const transform = useStore((s) => s.transform) // [x, y, zoom]

  return useMemo(() => {
    if (selectedPositions.length < 1) return null

    let maxX = -Infinity
    let minY = Infinity
    for (const n of selectedPositions) {
      const w = n.width ?? NODE_WIDTH
      maxX = Math.max(maxX, n.x + w)
      minY = Math.min(minY, n.y)
    }

    const [vx, vy, zoom] = transform
    return {
      x: maxX * zoom + vx,
      y: minY * zoom + vy,
    }
  }, [selectedPositions, transform])
}
