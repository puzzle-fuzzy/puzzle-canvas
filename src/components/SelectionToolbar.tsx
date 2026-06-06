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
  const iconSize = useUIStore((s) => s.toolbarIconSize)
  const setFullscreenPreview = useUIStore((s) => s.setFullscreenPreview)
  const handleOrganize = useCanvasStore((s) => s.handleOrganize)
  const handleDeleteSelected = useCanvasStore((s) => s.handleDeleteSelected)

  const nodes = useCanvasStore((s) => s.nodes)
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)

  const BoardIcon = useAppIcon('board')
  const DownloadIcon = useAppIcon('download')
  const DeleteIcon = useAppIcon('delete')
  const FullscreenIcon = useAppIcon('fullscreen')

  // 判断选中节点中是否包含图片或视频
  const hasMedia = nodes.some(
    (n) => selectedNodeIds.includes(n.id) && (n.type === 'imageNode' || n.type === 'videoNode'),
  )

  const handleFullscreen = () => {
    const { nodes: allNodes, selectedNodeIds: ids } = useCanvasStore.getState()
    // 找到第一个选中的图片或视频节点
    const mediaNode = allNodes.find(
      (n) => ids.includes(n.id) && (n.type === 'imageNode' || n.type === 'videoNode'),
    )
    if (mediaNode && mediaNode.data.src) {
      setFullscreenPreview({
        src: mediaNode.data.src,
        fileName: mediaNode.data.fileName,
        mediaType: mediaNode.type === 'videoNode' ? 'video' : 'image',
      })
    }
  }

  return (
    <div
      className={`selection-toolbar ${darkMode ? 'dark' : 'light'}`}
      style={{
        position: 'absolute',
        left: position.x,
        top: `calc(${position.y}px - var(--mode-toolbar-size))`,
        transform: 'translateX(-100%)',
      }}
    >
      {selectedCount > 1 && (
        <button className="selection-toolbar-btn" onClick={handleOrganize} title="整理">
          <Icon size={Math.round(iconSize * 0.75)}><BoardIcon /></Icon>
        </button>
      )}
      {hasMedia && (
        <button className="selection-toolbar-btn" onClick={handleFullscreen} title="全屏预览">
          <Icon size={Math.round(iconSize * 0.75)}><FullscreenIcon /></Icon>
        </button>
      )}
      <button className="selection-toolbar-btn" onClick={onDownload} title="下载">
        <Icon size={Math.round(iconSize * 0.75)}><DownloadIcon /></Icon>
        </button>
      <button
        className="selection-toolbar-btn selection-toolbar-btn--danger"
        onClick={handleDeleteSelected}
        title="删除"
      >
        <Icon size={Math.round(iconSize * 0.75)}><DeleteIcon /></Icon>
      </button>
    </div>
  )
}

export default SelectionToolbar
