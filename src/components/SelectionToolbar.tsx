import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import { useCanvasStore } from '../stores/canvasStore'
import { useUIStore } from '../stores/uiStore'

interface SelectionToolbarProps {
  position: { x: number; y: number }
  selectedCount: number
  onDownload: () => void
}

function SelectionToolbar({ position, selectedCount, onDownload }: SelectionToolbarProps) {
  const darkMode = useUIStore((s) => s.darkMode)
  const handleOrganize = useCanvasStore((s) => s.handleOrganize)
  const handleDeleteSelected = useCanvasStore((s) => s.handleDeleteSelected)

  const BoardIcon = useAppIcon('board')
  const DownloadIcon = useAppIcon('download')
  const DeleteIcon = useAppIcon('delete')

  return (
    <div
      className={`selection-toolbar ${darkMode ? 'dark' : 'light'}`}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y - 44,
        transform: 'translateX(-100%)',
      }}
    >
      {selectedCount > 1 && (
        <button className="selection-toolbar-btn" onClick={handleOrganize} title="整理">
          <Icon size={15}><BoardIcon /></Icon>
        </button>
      )}
      <button className="selection-toolbar-btn" onClick={onDownload} title="下载">
        <Icon size={15}><DownloadIcon /></Icon>
      </button>
      <button
        className="selection-toolbar-btn selection-toolbar-btn--danger"
        onClick={handleDeleteSelected}
        title="删除"
      >
        <Icon size={15}><DeleteIcon /></Icon>
      </button>
    </div>
  )
}

export default SelectionToolbar
