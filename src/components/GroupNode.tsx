import { useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Icon } from '@ricons/utils'
import type { GroupNodeType } from '../types'
import { useUIStore } from '../stores/uiStore'
import { useCanvasStore } from '../stores/canvasStore'
import { useAppIcon } from '../icons'

/**
 * 小组节点组件
 *
 * 渲染为虚线边框 + 标签 + 半透明主题色背景的容器。
 * 不可选中（selectable: false），hover 时显示操作按钮。
 * 小组节点排在 nodes 数组前面（渲染层级更低），
 * 内容节点渲染在上层，点击成员区域优先选中成员。
 */
function GroupNode({ id, data }: NodeProps<GroupNodeType>) {
  const darkMode = useUIStore((s) => s.darkMode)
  const iconSize = useUIStore((s) => s.toolbarIconSize)
  const handleOrganizeGroup = useCanvasStore((s) => s.handleOrganizeGroup)
  const handleUngroup = useCanvasStore((s) => s.handleUngroup)
  const openGroupNameModal = useUIStore((s) => s.openGroupNameModal)

  const [hovered, setHovered] = useState(false)

  const OrganizeIcon = useAppIcon('board')
  const EditIcon = useAppIcon('edit')
  const DeleteIcon = useAppIcon('delete')

  return (
    <div
      className={`group-node ${darkMode ? 'dark' : 'light'}`}
      style={{ width: data.width, height: data.height }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="group-node-label">{data.label}</span>

      {hovered && (
        <div
          className={`selection-toolbar group-node-actions ${darkMode ? 'dark' : 'light'}`}
        >
          <button
            className="selection-toolbar-btn"
            onClick={(e) => {
              e.stopPropagation()
              handleOrganizeGroup(id)
            }}
            title="整理"
          >
            <Icon size={iconSize}><OrganizeIcon /></Icon>
          </button>
          <button
            className="selection-toolbar-btn"
            onClick={(e) => {
              e.stopPropagation()
              openGroupNameModal('rename', id)
            }}
            title="重命名"
          >
            <Icon size={iconSize}><EditIcon /></Icon>
          </button>
          <button
            className="selection-toolbar-btn selection-toolbar-btn--danger"
            onClick={(e) => {
              e.stopPropagation()
              handleUngroup(id)
            }}
            title="取消分组"
          >
            <Icon size={iconSize}><DeleteIcon /></Icon>
          </button>
        </div>
      )}
    </div>
  )
}

export default GroupNode
