import { useState, useCallback } from 'react'
import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import { useUIStore } from '../stores/uiStore'
import { useCanvasStore } from '../stores/canvasStore'
import { createShare, type NodeSnapshot } from '../utils/api'
import { useFocusTrap } from '../hooks/useFocusTrap'

export default function ShareModal() {
  const showShareModal = useUIStore((s) => s.showShareModal)
  const setShowShareModal = useUIStore((s) => s.setShowShareModal)
  const showError = useUIStore((s) => s.showError)

  const [shareKey, setShareKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const CopyIcon = useAppIcon('copy')

  useFocusTrap(showShareModal)

  const selectedCount = useCanvasStore((s) => {
    const nonGroup = s.selectedNodeIds.filter((id) => {
      const node = s.nodes.find((n) => n.id === id)
      return node && node.type !== 'groupNode'
    })
    return nonGroup.length
  })

  const handleClose = useCallback(() => {
    setShowShareModal(false)
    setShareKey(null)
    setCopied(false)
  }, [setShowShareModal])

  const handleShare = useCallback(async () => {
    const { nodes, selectedNodeIds } = useCanvasStore.getState()
    // 过滤掉 groupNode（小组成员关系在目标画布无意义）
    const selected = nodes.filter(
      (n) => selectedNodeIds.includes(n.id) && n.type !== 'groupNode',
    )
    if (selected.length === 0) {
      showError('请先选择要分享的节点')
      return
    }

    const snapshots: NodeSnapshot[] = selected.map((n) => {
      const base: NodeSnapshot = { type: n.type }
      const data = n.data as Record<string, unknown>
      if ('url' in data) base.url = data.url as string
      if ('title' in data) base.title = data.title as string
      if ('description' in data) base.description = data.description as string
      if ('image' in data) base.image = data.image as string | null
      if ('favicon' in data) base.favicon = data.favicon as string | null
      if ('src' in data) base.src = data.src as string
      if ('fileName' in data) base.fileName = data.fileName as string
      if ('fileSize' in data) base.fileSize = data.fileSize as number
      return base
    })

    setLoading(true)
    try {
      const key = await createShare(snapshots)
      setShareKey(key)
    } catch (err) {
      showError(err instanceof Error ? err.message : '分享失败')
    } finally {
      setLoading(false)
    }
  }, [showError])

  const handleCopy = useCallback(() => {
    if (!shareKey) return
    const text = `${window.location.origin}/s/${shareKey}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [shareKey])

  if (!showShareModal) return null

  return (
    <div className="share-overlay" onClick={handleClose}>
      <div
        className="share-modal"
        role="dialog"
        aria-modal="true"
        aria-label="分享节点"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-modal-header">
          <span className="share-modal-title">分享节点</span>
          <button className="share-modal-close" onClick={handleClose} aria-label="关闭">✕</button>
        </div>

        {!shareKey ? (
          <div className="share-modal-body">
            <p className="share-modal-desc">将选中的 {selectedCount} 个节点生成分享密钥，其他用户可通过密钥导入。</p>
            <button
              className="share-modal-btn"
              onClick={handleShare}
              disabled={loading || selectedCount === 0}
            >
              {loading ? '生成中...' : '生成分享密钥'}
            </button>
          </div>
        ) : (
          <div className="share-modal-body">
            <p className="share-modal-desc">分享密钥已生成，复制后发送给同事即可。</p>
            <div className="share-modal-key-row">
              <code className="share-modal-key">{shareKey}</code>
              <button className="share-modal-copy-btn" onClick={handleCopy} aria-label="复制分享密钥">
                {copied ? '✓' : <Icon size={16}><CopyIcon /></Icon>}
              </button>
            </div>
            <div className="share-modal-url-row">
              <span className="share-modal-url-label">分享链接：</span>
              <code className="share-modal-url">{window.location.origin}/s/{shareKey}</code>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
