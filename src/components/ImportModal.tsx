import { useState, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useUIStore } from '../stores/uiStore'
import { useCanvasStore } from '../stores/canvasStore'
import { fetchShare, persistNode } from '../utils/api'
import { localWaterfallLayout } from '../utils/layout'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { AppNode } from '../types'

export default function ImportModal() {
  const showImportModal = useUIStore((s) => s.showImportModal)
  const setShowImportModal = useUIStore((s) => s.setShowImportModal)
  const showError = useUIStore((s) => s.showError)
  const { screenToFlowPosition } = useReactFlow()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  useFocusTrap(showImportModal)

  const handleClose = useCallback(() => {
    setShowImportModal(false)
    setInput('')
  }, [setShowImportModal])

  const handleImport = useCallback(async () => {
    const raw = input.trim()
    if (!raw) return

    let key = raw
    // 支持 URL 格式：提取最后一段作为 key
    if (raw.startsWith('http')) {
      const parts = raw.split('/')
      key = parts[parts.length - 1]
    }

    // 密钥格式校验：8 位十六进制
    if (!/^[0-9a-f]{8}$/i.test(key)) {
      showError('无效的分享密钥格式')
      return
    }

    setLoading(true)
    try {
      const snapshots = await fetchShare(key)
      if (!snapshots.length) {
        showError('分享中没有节点')
        return
      }

      // 过滤掉 groupNode
      const filtered = snapshots.filter((s) => s.type !== 'groupNode')
      if (!filtered.length) {
        showError('分享中没有可导入的节点')
        return
      }

      const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      const origin = screenToFlowPosition(mouse)
      const layout = localWaterfallLayout(origin)

      const newNodes: AppNode[] = filtered.map((snap) => {
        const id = crypto.randomUUID()
        // 根据节点类型估算高度
        const estimatedHeight = snap.type === 'textNode' ? 320 : 200
        const pos = layout.next(estimatedHeight)

        const base: Record<string, unknown> = {
          id,
          type: snap.type,
          position: pos,
          data: {} as Record<string, unknown>,
        }

        switch (snap.type) {
          case 'urlNode':
            base.data = {
              url: snap.url ?? '',
              title: snap.title ?? '',
              description: snap.description ?? '',
              image: snap.image ?? null,
              favicon: snap.favicon ?? null,
            }
            break
          case 'textNode':
            base.data = {
              description: snap.description ?? '',
            }
            break
          case 'imageNode':
          case 'videoNode':
            base.data = {
              src: snap.src ?? '',
              fileName: snap.fileName ?? '',
            }
            break
          case 'docNode':
            base.data = {
              src: snap.src ?? '',
              fileName: snap.fileName ?? '',
              fileSize: snap.fileSize ?? 0,
            }
            break
          default:
            base.data = { src: snap.src ?? '', fileName: snap.fileName ?? '' }
        }

        return base as unknown as AppNode
      })

      useCanvasStore.getState().setNodes((prev) => [...prev, ...newNodes])
      for (const node of newNodes) {
        persistNode(node)
      }

      handleClose()
    } catch (err) {
      showError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setLoading(false)
    }
  }, [input, showError, handleClose, screenToFlowPosition])

  if (!showImportModal) return null

  return (
    <div className="share-overlay" onClick={handleClose}>
      <div
        className="share-modal"
        role="dialog"
        aria-modal="true"
        aria-label="导入节点"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-modal-header">
          <span className="share-modal-title">导入节点</span>
          <button className="share-modal-close" onClick={handleClose} aria-label="关闭">✕</button>
        </div>
        <div className="share-modal-body">
          <p className="share-modal-desc">粘贴同事分享的密钥或链接，导入到你的画布。</p>
          <input
            className="share-modal-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入分享密钥或链接"
            aria-label="分享密钥或链接"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleImport()
            }}
          />
          <button
            className="share-modal-btn"
            onClick={handleImport}
            disabled={loading || !input.trim()}
          >
            {loading ? '导入中...' : '导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
