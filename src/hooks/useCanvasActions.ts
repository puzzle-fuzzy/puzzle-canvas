import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useInputStore } from '../stores/inputStore'
import { useCanvasStore } from '../stores/canvasStore'
import { useNodeActions } from './useNodeActions'
import { useDownload } from './useDownload'
import { isValidUrl, persistNodePosition, persistNodeGroupId, persistGroupUpdate, computeGroupBounds } from '../utils'
import type { AppNode } from '../types'

/**
 * 画布事件 hook — 粘贴/拖拽/视口/拖拽结束的事件桥接
 * 组合 useNodeActions + useDownload，对外统一暴露
 */

export function useCanvasActions() {
  const { screenToFlowPosition, getViewport } = useReactFlow()

  // 拖拽起始位置缓存（跟随组件生命周期，避免模块级变量跨实例污染）
  const dragStartPositionsRef = useRef<Record<string, { x: number; y: number }>>({})
  // 标记成员节点是否已在本轮拖拽中脱离小组
  const dragRemovedFromGroupRef = useRef(false)
  const { addNodeFromUrl, addNodeFromText, addNodeFromFiles, handleAIGenerate } = useNodeActions()
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
      } else if (text) {
        e.preventDefault()
        addNodeFromText(text)
      }
    },
    [addNodeFromUrl, addNodeFromText, addNodeFromFiles, screenToFlowPosition],
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
    try {
      localStorage.setItem('viewport', JSON.stringify({ x, y, zoom }))
    } catch {
      // localStorage 可能不可用（隐私模式、配额满）
    }
  }, [getViewport])

  // ========== 小组拖拽：记录起始位置 ==========
  const handleNodeDragStart = useCallback(
    (_event: MouseEvent | TouchEvent, node: AppNode) => {
      dragStartPositionsRef.current = {}
      dragRemovedFromGroupRef.current = false

      if (node.type === 'groupNode') {
        // 记录小组节点和所有成员的起始位置
        const { nodes } = useCanvasStore.getState()
        const memberIds = new Set(
          nodes
            .filter(
              (n) =>
                n.type !== 'groupNode' &&
                (n.data as { groupId?: string }).groupId === node.id,
            )
            .map((n) => n.id),
        )

        dragStartPositionsRef.current[node.id] = { ...node.position }
        for (const n of nodes) {
          if (memberIds.has(n.id)) {
            dragStartPositionsRef.current[n.id] = { ...n.position }
          }
        }
      } else {
        dragStartPositionsRef.current[node.id] = { ...node.position }
      }
    },
    [],
  )

  // ========== 拖拽过程中：同步小组成员 / 检测成员脱离 ==========
  const handleNodeDrag = useCallback(
    (_event: MouseEvent | TouchEvent, node: AppNode) => {
      const dragStartPositions = dragStartPositionsRef.current

      // 拖拽 groupNode → 同步移动所有成员
      if (node.type === 'groupNode') {
        const startPos = dragStartPositions[node.id]
        if (!startPos) return

        const dx = node.position.x - startPos.x
        const dy = node.position.y - startPos.y

        // 如果几乎没有移动，跳过
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return

        const { nodes } = useCanvasStore.getState()
        const memberIds = new Set(
          nodes
            .filter(
              (n) =>
                n.type !== 'groupNode' &&
                (n.data as { groupId?: string }).groupId === node.id,
            )
            .map((n) => n.id),
        )

        useCanvasStore.getState().setNodes((prev) =>
          prev.map((n) => {
            if (!memberIds.has(n.id)) return n
            const memberStart = dragStartPositions[n.id]
            if (!memberStart) return n
            return {
              ...n,
              position: { x: memberStart.x + dx, y: memberStart.y + dy },
            }
          }),
        )
        return
      }

      // 拖拽成员节点 → 检测是否脱离小组
      if (dragRemovedFromGroupRef.current) return
      const data = node.data as { groupId?: string }
      if (!data.groupId) return

      const { nodes } = useCanvasStore.getState()
      const groupNode = nodes.find((n) => n.id === data.groupId && n.type === 'groupNode')
      if (!groupNode) return

      const { width: gw, height: gh } = (groupNode as AppNode & { data: { width: number; height: number } }).data
      const nodeW = node.measured?.width ?? 320
      const nodeH = node.measured?.height ?? 200
      const nodeCX = node.position.x + nodeW / 2
      const nodeCY = node.position.y + nodeH / 2

      // 节点中心超出小组边界 → 脱离
      if (
        nodeCX < groupNode.position.x ||
        nodeCX > groupNode.position.x + gw ||
        nodeCY < groupNode.position.y ||
        nodeCY > groupNode.position.y + gh
      ) {
        dragRemovedFromGroupRef.current = true
        const gid = data.groupId

        useCanvasStore.getState().setNodes((prev) =>
          prev.map((n) =>
            n.id === node.id
              ? { ...n, data: { ...n.data, groupId: undefined } } as AppNode
              : n,
          ),
        )
        persistNodeGroupId(node.id, null)

        // 重新计算小组边界
        const remaining = useCanvasStore
          .getState()
          .nodes
          .filter((n) =>
            n.type !== 'groupNode' &&
            (n.data as { groupId?: string }).groupId === gid,
          )

        const newBounds = computeGroupBounds(remaining)
        if (newBounds) {
          useCanvasStore.getState().setNodes((prev) =>
            prev.map((n) =>
              n.id === gid && n.type === 'groupNode'
                ? {
                    ...n,
                    position: { x: newBounds.x, y: newBounds.y },
                    data: { ...n.data, width: newBounds.width, height: newBounds.height },
                  }
                : n,
            ),
          )
          persistGroupUpdate(gid, { width: newBounds.width, height: newBounds.height })
          persistNodePosition(gid, newBounds.x, newBounds.y)
        }
      }
    },
    [],
  )

  // ========== 拖拽结束持久化 ==========
  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: AppNode) => {
      const dragStartPositions = dragStartPositionsRef.current

      if (node.type === 'groupNode') {
        const startPos = dragStartPositions[node.id]
        if (startPos) {
          const dx = node.position.x - startPos.x
          const dy = node.position.y - startPos.y

          // 持久化小组节点位置
          persistNodePosition(node.id, node.position.x, node.position.y)

          // 持久化所有成员的新位置
          const { nodes } = useCanvasStore.getState()
          for (const n of nodes) {
            if (
              n.type !== 'groupNode' &&
              (n.data as { groupId?: string }).groupId === node.id
            ) {
              const memberStart = dragStartPositions[n.id]
              if (memberStart) {
                persistNodePosition(n.id, memberStart.x + dx, memberStart.y + dy)
              }
            }
          }
        }
      } else {
        persistNodePosition(node.id, node.position.x, node.position.y)
      }

      dragStartPositionsRef.current = {}
    },
    [],
  )

  return {
    handlePaste,
    handleDragOver,
    handleDrop,
    handleAIGenerate,
    handleMoveEnd,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
    handleDownloadSelected,
  }
}
