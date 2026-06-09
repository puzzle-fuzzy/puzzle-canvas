import { useState, useMemo } from 'react'
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

  const selectedIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds])

  // 获取选中的节点并派生操作条件
  const { canCreateGroup, hasMedia, hasUrl } = useMemo(() => {
    const selectedNodes = nodes.filter((n) => selectedIdSet.has(n.id))
    const nonGroupSelected = selectedNodes.filter(
      (n) => n.type !== 'groupNode' && !(n.data as { groupId?: string }).groupId,
    )
    return {
      canCreateGroup: nonGroupSelected.length >= 2,
      hasMedia: selectedNodes.some((n) => n.type === 'imageNode' || n.type === 'videoNode'),
      hasUrl: selectedNodes.some((n) => n.type === 'urlNode'),
    }
  }, [nodes, selectedIdSet])

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
        <button className="selection-toolbar-btn" onClick={handleOrganize} aria-label="整理">
          <Icon size={iconSize}><BoardIcon /></Icon>
        </button>
      )}
      {canCreateGroup && (
        <button
          className="selection-toolbar-btn"
          onClick={() => openGroupNameModal('create')}
          aria-label="设置小组"
        >
          <Icon size={iconSize}><GroupIcon /></Icon>
        </button>
      )}
      {hasMedia && (
        <button className="selection-toolbar-btn" onClick={handleFullscreen} aria-label="全屏预览">
          <Icon size={iconSize}><FullscreenIcon /></Icon>
        </button>
      )}
      {hasUrl && (
        <button className="selection-toolbar-btn" onClick={handleCopyUrl} aria-label={copied ? '已复制' : '复制链接'}>
          {copied
            ? <span style={{ fontSize: '12px', fontWeight: 600 }}>✓</span>
            : <Icon size={iconSize}><CopyIcon /></Icon>
          }
        </button>
      )}
      <button className="selection-toolbar-btn" onClick={() => setShowShareModal(true)} aria-label="分享">
        <Icon size={iconSize}><ShareIcon /></Icon>
      </button>
      <button className="selection-toolbar-btn" onClick={onDownload} aria-label="下载">
        <Icon size={iconSize}><DownloadIcon /></Icon>
      </button>
      <button
        className="selection-toolbar-btn selection-toolbar-btn--danger"
        onClick={handleDeleteSelected}
        aria-label="删除"
      >
        <Icon size={iconSize}><DeleteIcon /></Icon>
      </button>
    </div>
  )
}

export default SelectionToolbar
