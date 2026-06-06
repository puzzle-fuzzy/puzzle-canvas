import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useInputStore } from '../stores/inputStore'
import { useNodeActions } from './useNodeActions'
import { useDownload } from './useDownload'
import { isValidUrl, persistNodePosition } from '../utils'
import type { AppNode } from '../types'

/**
 * 画布事件 hook — 粘贴/拖拽/视口/拖拽结束的事件桥接
 * 组合 useNodeActions + useDownload，对外统一暴露
 */
export function useCanvasActions() {
  const { screenToFlowPosition, getViewport } = useReactFlow()
  const { addNodeFromUrl, addNodeFromFiles, handleAIGenerate } = useNodeActions()
  const { handleDownloadSelected } = useDownload()

  // ========== 粘贴事件 ==========
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        e.preventDefault()
        const mouse = useInputStore.getState().mousePosition
        const origin = screenToFlowPosition(mouse)
        addNodeFromFiles(files, origin)
        return
      }

      const text = e.clipboardData?.getData('text')?.trim()
      if (text && isValidUrl(text)) {
        e.preventDefault()
        addNodeFromUrl(text)
      }
    },
    [addNodeFromUrl, addNodeFromFiles, screenToFlowPosition],
  )

  // ========== 拖拽事件 ==========
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const files = e.dataTransfer.files
      if (files.length > 0) {
        const origin = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        addNodeFromFiles(files, origin)
      }
    },
    [addNodeFromFiles, screenToFlowPosition],
  )

  // ========== 视口变化时保存到 localStorage ==========
  const handleMoveEnd = useCallback(() => {
    const { x, y, zoom } = getViewport()
    localStorage.setItem('viewport', JSON.stringify({ x, y, zoom }))
  }, [getViewport])

  // ========== 拖拽结束持久化 ==========
  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: AppNode) => {
      persistNodePosition(node.id, node.position.x, node.position.y)
    },
    [],
  )

  return {
    handlePaste,
    handleDragOver,
    handleDrop,
    handleAIGenerate,
    handleMoveEnd,
    handleNodeDragStop,
    handleDownloadSelected,
  }
}
