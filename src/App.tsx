import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
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
  const nodesRef = useRef<AppNode[]>(nodes)
  nodesRef.current = nodes
  const mouseRef = useRef({ x: 0, y: 0 })
  const { screenToFlowPosition, fitView } = useReactFlow()
  const [spaceHeld, setSpaceHeld] = useState(false)

  // 追踪空格键状态
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // 追踪鼠标位置
  useEffect(() => {
    const track = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', track)
    return () => window.removeEventListener('mousemove', track)
  }, [])

  // ========== 初始加载节点 ==========
  useEffect(() => {
    loadNodes()
      .then((loaded) => {
        setNodes(loaded)
        setInitialized(true)
        // 节点加载完后 fitView 展示全部
        setTimeout(() => fitView({ padding: 0.2 }), 200)
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
      }
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds)
        nodesRef.current = updated
        return updated
      })
    },
    [],
  )

  // ========== 拖拽结束持久化 ==========
  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: AppNode) => {
      const latest = nodesRef.current.find((n) => n.id === node.id)
      if (latest) {
        persistNodePosition(latest.id, latest.position.x, latest.position.y)
      }
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
        nodeTypes={nodeTypes}
        minZoom={0.01}
        maxZoom={4}
        panOnDrag={!spaceHeld}
        selectionOnDrag={spaceHeld}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        panOnScroll={false}
        deleteKeyCode="Delete"
        selectionKeyCode={null}
        multiSelectionKeyCode="Shift"
      >
        <Background />
        <Controls />
        <MiniMap
          pannable
          zoomable
          style={{ background: 'var(--minimap-bg, #f0f0f0)' }}
        />
      </ReactFlow>

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
