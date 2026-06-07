import type { NodeProps } from '@xyflow/react'
import type { GroupNodeType } from '../types'
import { useCanvasStore } from '../stores/canvasStore'

/**
 * 小组节点组件
 *
 * 渲染为虚线边框 + 标签 + 半透明主题色背景的容器。
 * 不可选中（selectable: false），点击空白区域聚焦（边框变实线）。
 * 操作栏渲染在 ReactFlow 外部（GroupToolbar），不随画布缩放。
 */
function GroupNode({ id, data }: NodeProps<GroupNodeType>) {
  const focusedGroupId = useCanvasStore((s) => s.focusedGroupId)
  const focused = focusedGroupId === id

  return (
    <div
      className={`group-node ${focused ? 'group-node--focused' : ''}`}
      style={{ width: data.width || 400, height: data.height || 300 }}
    >
      <span className="group-node-label">{data.label}</span>
    </div>
  )
}

export default GroupNode
