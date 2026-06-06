import { useCallback } from 'react'
import { useCanvasStore } from '../stores/canvasStore'
import { getApiUrl } from '../utils'
import type { ImageNodeType, VideoNodeType, DocNodeType } from '../types'

type DownloadableNode = ImageNodeType | VideoNodeType | DocNodeType

/**
 * 选区下载 hook — 纯 fetch 逻辑，不需要 ReactFlow
 */
export function useDownload() {
  const handleDownloadSelected = useCallback(async () => {
    const { nodes, selectedNodeIds } = useCanvasStore.getState()
    const selected = nodes.filter((n) => selectedNodeIds.includes(n.id))
    const downloadable = selected.filter(
      (n) =>
        n.type === 'imageNode' ||
        n.type === 'videoNode' ||
        n.type === 'docNode',
    ) as DownloadableNode[]

    if (downloadable.length === 0) return

    for (const node of downloadable) {
      try {
        const url = getApiUrl(node.data.src)
        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(`下载失败 (${res.status})`)
        }
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = node.data.fileName || `download-${node.id}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(a.href)
      } catch (err) {
        console.error('Failed to download:', node.data.fileName, err)
      }
    }
  }, [])

  return { handleDownloadSelected }
}
