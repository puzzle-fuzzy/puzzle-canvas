import { useState, useCallback, useRef, useEffect } from 'react'
import { LayoutGrid, Download, Trash2 } from 'lucide-react'
import {
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  useStore,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import UrlNode from './components/UrlNode'
import MediaNode from './components/MediaNode'
import type {
  AppNode,
  UrlNodeType,
  ImageNodeType,
  VideoNodeType,
  MetadataResponse,
} from './types'
import {
  isValidUrl,
  uploadFile,
  persistNode,
  persistNodePosition,
  persistNodeDelete,
  loadNodes,
  localWaterfallLayout,
  selectionWaterfallLayout,
  getImageRenderHeight,
  getApiUrl,
} from './utils'
import './App.css'

const nodeTypes = {
  urlNode: UrlNode,
  imageNode: MediaNode,
  videoNode: MediaNode,
}

function Canvas() {
  const [nodes, setNodes] = useState<AppNode[]>([])
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const nodesRef = useRef<AppNode[]>(nodes)
  nodesRef.current = nodes
  const mouseRef = useRef({ x: 0, y: 0 })
  const { screenToFlowPosition, getViewport } = useReactFlow()
  const transform = useStore((s) => s.transform) // [x, y, zoom] — 视口变化时重新计算按钮位置

  // 追踪选中的节点
  const handleSelectionChange = useCallback(
    ({ nodes: sel }: { nodes: { id: string }[] }) => {
      setSelectedNodeIds(sel.map((n) => n.id))
    },
    [],
  )

  // 追踪鼠标位置
  useEffect(() => {
    const track = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', track)
    return () => window.removeEventListener('mousemove', track)
  }, [])

  // ========== 初始视口（渲染前从 localStorage 读取，避免闪烁）==========
  const savedViewport = useRef(() => {
    try {
      const raw = localStorage.getItem('viewport')
      if (raw) {
        const { x, y, zoom } = JSON.parse(raw)
        return { x, y, zoom }
      }
    } catch { /* ignore */ }
    return { x: 0, y: 0, zoom: 0.5 }
  }).current()

  // ========== 初始加载节点 ==========
  useEffect(() => {
    loadNodes()
      .then((loaded) => {
        setNodes(loaded)
        setInitialized(true)
      })
      .catch((err) => {
        console.error('Failed to load nodes:', err)
        setInitialized(true)
      })
  }, [])

  // ========== 节点变更 ==========
  const onNodesChange: OnNodesChange<AppNode> = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          persistNodeDelete(change.id)
        }
        // 拖拽结束时持久化位置（dragging 从 true 变 false）
        if (
          change.type === 'position' &&
          change.dragging === false &&
          change.position
        ) {
          persistNodePosition(change.id, change.position.x, change.position.y)
        }
      }
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds)
        nodesRef.current = updated
        return updated
      })
    },
    [],
  )

  // ========== 选区整理（瀑布流）==========
  const handleOrganize = useCallback(() => {
    const allNodes = nodesRef.current
    const selected = allNodes.filter((n) => selectedNodeIds.includes(n.id))
    if (selected.length < 2) return

    const positions = selectionWaterfallLayout(selected)

    setNodes((prev) => {
      const updated = prev.map((node) => {
        const newPos = positions.get(node.id)
        if (!newPos) return node
        return { ...node, position: newPos }
      })
      nodesRef.current = updated
      return updated
    })

    for (const [id, pos] of positions.entries()) {
      persistNodePosition(id, pos.x, pos.y)
    }
  }, [selectedNodeIds])

  // ========== 选区删除 ==========
  const handleDeleteSelected = useCallback(() => {
    setNodes((prev) => {
      const updated = prev.filter((n) => !selectedNodeIds.includes(n.id))
      nodesRef.current = updated
      return updated
    })
    for (const id of selectedNodeIds) {
      persistNodeDelete(id)
    }
    setSelectedNodeIds([])
  }, [selectedNodeIds])

  // ========== 选区下载（图片/视频）==========
  const handleDownloadSelected = useCallback(async () => {
    const selected = nodesRef.current.filter((n) => selectedNodeIds.includes(n.id))
    const mediaNodes = selected.filter(
      (n) => n.type === 'imageNode' || n.type === 'videoNode',
    ) as (ImageNodeType | VideoNodeType)[]

    if (mediaNodes.length === 0) return

    for (const node of mediaNodes) {
      try {
        const url = getApiUrl(node.data.src)
        const res = await fetch(url)
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
  }, [selectedNodeIds])

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

  // ========== URL 节点 ==========
  const addNodeFromUrl = useCallback(
    async (url: string) => {
      if (loading) return
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '请求失败' }))
          throw new Error(err.error ?? `请求失败 (${res.status})`)
        }

        const data: MetadataResponse = await res.json()
        const pos = screenToFlowPosition(mouseRef.current)

        const newNode: UrlNodeType = {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'urlNode',
          position: pos,
          data: {
            url: data.url,
            title: data.title,
            description: data.description,
            image: data.image,
            favicon: data.favicon,
          },
        }

        setNodes((prev) => [...prev, newNode])
        persistNode(newNode)
      } catch (err) {
        setError(err instanceof Error ? err.message : '发生未知错误')
        setTimeout(() => setError(null), 3000)
      } finally {
        setLoading(false)
      }
    },
    [loading, screenToFlowPosition],
  )

  // ========== 文件节点（多文件局部瀑布流）==========
  const addNodeFromFiles = useCallback(
    async (files: FileList | File[], origin: { x: number; y: number }) => {
      if (loading) return

      const validFiles = Array.from(files).filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
      )
      if (validFiles.length === 0) {
        setError('仅支持图片和视频文件')
        setTimeout(() => setError(null), 3000)
        return
      }

      setLoading(true)
      setError(null)

      const layout = localWaterfallLayout(origin)

      for (const file of validFiles) {
        try {
          const result = await uploadFile(file)

          // 获取实际渲染高度用于瀑布流定位
          let height = 320
          if (result.mediaType === 'image') {
            height = await getImageRenderHeight(getApiUrl(result.src))
          }
          const pos = layout.next(height)

          const newNode: ImageNodeType | VideoNodeType = {
            id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: result.mediaType === 'video' ? 'videoNode' : 'imageNode',
            position: pos,
            data: { src: result.src, fileName: result.fileName },
          }

          setNodes((prev) => {
            const updated = [...prev, newNode]
            nodesRef.current = updated
            return updated
          })
          persistNode(newNode)
        } catch (err) {
          setError(err instanceof Error ? err.message : '上传失败')
          setTimeout(() => setError(null), 3000)
        }
      }

      setLoading(false)
    },
    [loading],
  )

  // ========== 粘贴事件 ==========
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        e.preventDefault()
        const origin = screenToFlowPosition(mouseRef.current)
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

  useEffect(() => {
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handlePaste])

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

  if (!initialized) {
    return (
      <div className="canvas-loading">
        <span>加载中...</span>
      </div>
    )
  }

  // 计算选区工具栏位置（包围盒右上角，屏幕坐标）
  const toolbarPos = (() => {
    if (selectedNodeIds.length < 2) return null
    const selected = nodesRef.current.filter((n) => selectedNodeIds.includes(n.id))
    if (selected.length === 0) return null

    let maxX = -Infinity
    let minY = Infinity
    for (const n of selected) {
      const w = n.measured?.width ?? (n.type === 'urlNode' ? 280 : 320)
      maxX = Math.max(maxX, n.position.x + w)
      minY = Math.min(minY, n.position.y)
    }

    const [vx, vy, zoom] = transform
    return {
      x: maxX * zoom + vx,
      y: minY * zoom + vy,
    }
  })()

  return (
    <div
      className="canvas-container"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={handleMoveEnd}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        defaultViewport={savedViewport}
        minZoom={0.01}
        maxZoom={4}
        panOnDrag
        selectionKeyCode="Space"
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
      >
        <Background />
        <Controls />
        <MiniMap
          pannable
          zoomable
          style={{ background: 'var(--minimap-bg, #f0f0f0)' }}
        />
      </ReactFlow>

      {toolbarPos && (
        <div
          className="selection-toolbar"
          style={{
            position: 'absolute',
            left: toolbarPos.x,
            top: toolbarPos.y - 44,
            transform: 'translateX(-100%)',
          }}
        >
          <button className="selection-toolbar-btn" onClick={handleOrganize} title="整理">
            <LayoutGrid size={15} />
          </button>
          <button className="selection-toolbar-btn" onClick={handleDownloadSelected} title="下载">
            <Download size={15} />
          </button>
          <button className="selection-toolbar-btn selection-toolbar-btn--danger" onClick={handleDeleteSelected} title="删除">
            <Trash2 size={15} />
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-indicator">处理中...</div>
      )}

      {error && <div className="error-toast">{error}</div>}

      {initialized && nodes.length === 0 && !loading && (
        <div className="empty-hint">
          <p>🌐 粘贴网址、图片或视频到画布上</p>
          <p className="empty-hint-sub">支持 Ctrl+V / ⌘+V 粘贴，或拖拽文件</p>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}

export default App
