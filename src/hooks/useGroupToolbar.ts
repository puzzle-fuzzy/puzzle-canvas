import { useMemo } from 'react'
import { useStore } from '@xyflow/react'
import { useCanvasStore } from '../stores/canvasStore'

/**
 * 计算小组聚焦时浮动工具栏的位置
 * 将小组节点的右上角从 flow 坐标转换为屏幕像素坐标
 * 返回 null 表示无聚焦的小组
 */
export function useGroupToolbar(): { x: number; y: number; groupId: string } | null {
  const focusedGroupId = useCanvasStore((s) => s.focusedGroupId)
  const nodes = useCanvasStore((s) => s.nodes)
  const transform = useStore((s) => s.transform) // [x, y, zoom]

  return useMemo(() => {
    if (!focusedGroupId) return null

    const groupNode = nodes.find((n) => n.id === focusedGroupId && n.type === 'groupNode')
    if (!groupNode) return null

    const { width } = groupNode.data as { width: number; height: number }

    // 小组右上角 flow 坐标
    const rightX = groupNode.position.x + width
    const topY = groupNode.position.y

    // flow → screen
    const [vx, vy, zoom] = transform
    return {
      x: rightX * zoom + vx,
      y: topY * zoom + vy,
      groupId: focusedGroupId,
    }
  }, [focusedGroupId, nodes, transform])
}
