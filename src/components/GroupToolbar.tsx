import { Icon } from '@ricons/utils'
import { useUIStore } from '../stores/uiStore'
import { useCanvasStore } from '../stores/canvasStore'
import { useAppIcon } from '../icons'

interface GroupToolbarProps {
  position: { x: number; y: number; groupId: string }
}

/**
 * 小组聚焦时的浮动操作工具栏
 * 渲染在 ReactFlow 外部，不随画布缩放
 */
function GroupToolbar({ position }: GroupToolbarProps) {
  const darkMode = useUIStore((s) => s.darkMode)
  const iconSize = useUIStore((s) => s.toolbarIconSize)
  const handleOrganizeGroup = useCanvasStore((s) => s.handleOrganizeGroup)
  const handleUngroup = useCanvasStore((s) => s.handleUngroup)
  const openGroupNameModal = useUIStore((s) => s.openGroupNameModal)

  const OrganizeIcon = useAppIcon('board')
  const EditIcon = useAppIcon('edit')
  const DeleteIcon = useAppIcon('delete')

  const { groupId } = position

  return (
    <div
      className={`selection-toolbar ${darkMode ? 'dark' : 'light'}`}
      style={{
        position: 'absolute',
        left: position.x,
        top: `calc(${position.y}px - var(--mode-toolbar-size) - 10px)`,
        transform: 'translateX(-100%)',
      }}
    >
      <button
        className="selection-toolbar-btn"
        onClick={() => handleOrganizeGroup(groupId)}
        title="整理"
      >
        <Icon size={iconSize}><OrganizeIcon /></Icon>
      </button>
      <button
        className="selection-toolbar-btn"
        onClick={() => openGroupNameModal('rename', groupId)}
        title="重命名"
      >
        <Icon size={iconSize}><EditIcon /></Icon>
      </button>
      <button
        className="selection-toolbar-btn selection-toolbar-btn--danger"
        onClick={() => handleUngroup(groupId)}
        title="取消分组"
      >
        <Icon size={iconSize}><DeleteIcon /></Icon>
      </button>
    </div>
  )
}

export default GroupToolbar
