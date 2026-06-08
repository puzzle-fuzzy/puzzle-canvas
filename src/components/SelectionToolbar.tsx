import { useState } from 'react'
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
  const openGroupNameModal = useUIStore((s) => s.openGroupNameModal)
  const setShowShareModal = useUIStore((s) => s.setShowShareModal)

  const nodes = useCanvasStore((s) => s.nodes)
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)

  const BoardIcon = useAppIcon('board')
  const DownloadIcon = useAppIcon('download')
  const DeleteIcon = useAppIcon('delete')
  const FullscreenIcon = useAppIcon('fullscreen')
  const CopyIcon = useAppIcon('copy')
  const GroupIcon = useAppIcon('group')
  const ShareIcon = useAppIcon('share')

  const [copied, setCopied] = useState(false)

  // 获取选中的节点
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id))

  // 判断是否可以创建小组（2+ 非小组节点，且没有 groupId）
  const nonGroupSelected = selectedNodes.filter(
    (n) => n.type !== 'groupNode' && !(n.data as { groupId?: string }).groupId,
  )
  const canCreateGroup = nonGroupSelected.length >= 2

  // 判断选中节点中是否包含图片或视频
  const hasMedia = selectedNodes.some(
    (n) => n.type === 'imageNode' || n.type === 'videoNode',
  )

  // 判断选中节点中是否包含 URL 节点
  const hasUrl = selectedNodes.some((n) => n.type === 'urlNode')

  const handleCopyUrl = () => {
    const { nodes: allNodes, selectedNodeIds: ids } = useCanvasStore.getState()
    const urlNode = allNodes.find(
      (n) => ids.includes(n.id) && n.type === 'urlNode',
    ) as (typeof allNodes)[number] & { type: 'urlNode' } | undefined
    if (urlNode && 'url' in urlNode.data && urlNode.data.url) {
      navigator.clipboard.writeText(urlNode.data.url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
    }
  }

  const handleFullscreen = () => {
    const { nodes: allNodes, selectedNodeIds: ids } = useCanvasStore.getState()
    // 找到第一个选中的图片或视频节点
    const mediaNode = allNodes.find(
      (n) => ids.includes(n.id) && (n.type === 'imageNode' || n.type === 'videoNode'),
    ) as Extract<(typeof allNodes)[number], { type: 'imageNode' | 'videoNode' }> | undefined
    if (mediaNode) {
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
        top: `calc(${position.y}px - var(--mode-toolbar-size) - 10px)`,
        transform: 'translateX(-100%)',
      }}
    >
      {selectedCount > 1 && (
        <button className="selection-toolbar-btn" onClick={handleOrganize} title="整理">
          <Icon size={iconSize}><BoardIcon /></Icon>
        </button>
      )}
      {canCreateGroup && (
        <button
          className="selection-toolbar-btn"
          onClick={() => openGroupNameModal('create')}
          title="设置小组"
        >
          <Icon size={iconSize}><GroupIcon /></Icon>
        </button>
      )}
      {hasMedia && (
        <button className="selection-toolbar-btn" onClick={handleFullscreen} title="全屏预览">
          <Icon size={iconSize}><FullscreenIcon /></Icon>
        </button>
      )}
      {hasUrl && (
        <button className="selection-toolbar-btn" onClick={handleCopyUrl} title={copied ? '已复制' : '复制链接'}>
          {copied
            ? <span style={{ fontSize: '12px', fontWeight: 600 }}>✓</span>
            : <Icon size={iconSize}><CopyIcon /></Icon>
          }
        </button>
      )}
      <button className="selection-toolbar-btn" onClick={() => setShowShareModal(true)} title="分享">
        <Icon size={iconSize}><ShareIcon /></Icon>
      </button>
      <button className="selection-toolbar-btn" onClick={onDownload} title="下载">
        <Icon size={iconSize}><DownloadIcon /></Icon>
      </button>
      <button
        className="selection-toolbar-btn selection-toolbar-btn--danger"
        onClick={handleDeleteSelected}
        title="删除"
      >
        <Icon size={iconSize}><DeleteIcon /></Icon>
      </button>
    </div>
  )
}

export default SelectionToolbar
