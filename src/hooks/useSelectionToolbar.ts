import { useMemo } from 'react'
import { useStore } from '@xyflow/react'
import { useCanvasStore } from '../stores/canvasStore'
import { NODE_WIDTH } from '../utils'

/**
 * 计算选区浮动工具栏的位置
 * 返回 null 表示无选中或不可见
 */
export function useSelectionToolbar() {
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)
  const nodes = useCanvasStore((s) => s.nodes)
  const transform = useStore((s) => s.transform) // [x, y, zoom]

  return useMemo(() => {
    if (selectedNodeIds.length < 1) return null
    const selected = nodes.filter((n) => selectedNodeIds.includes(n.id))
    if (selected.length === 0) return null

    let maxX = -Infinity
    let minY = Infinity
    for (const n of selected) {
      const w = n.measured?.width ?? NODE_WIDTH
      maxX = Math.max(maxX, n.position.x + w)
      minY = Math.min(minY, n.position.y)
    }

    const [vx, vy, zoom] = transform
    return {
      x: maxX * zoom + vx,
      y: minY * zoom + vy,
    }
  }, [selectedNodeIds, nodes, transform])
}
