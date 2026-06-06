import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow,
  applyNodeChanges,
  Background,
  Controls,
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
  getNextPosition,
  uploadFile,
  persistNode,
  persistNodePosition,
  persistNodeDelete,
  loadNodes,
} from './utils'
import './App.css'

// 必须定义在组件外部，避免 xyflow 不必要的重渲染
const nodeTypes = {
  urlNode: UrlNode,
  imageNode: MediaNode,
  videoNode: MediaNode,
}

function App() {
  const [nodes, setNodes] = useState<AppNode[]>([])
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nodesRef = useRef<AppNode[]>(nodes)
  nodesRef.current = nodes

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

  // ========== 节点变更（拖拽、删除等） ==========
  const onNodesChange: OnNodesChange<AppNode> = useCallback(
    (changes) => {
      // 检测删除操作，同步到后端
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

  // ========== 拖拽结束：持久化位置 ==========
  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: AppNode) => {
      // 从 ref 获取最新位置（避免 xyflow 已知的 stale position 问题）
      const latest = nodesRef.current.find((n) => n.id === node.id)
      if (latest) {
        persistNodePosition(latest.id, latest.position.x, latest.position.y)
      }
    },
    [],
  )

  // ========== 根据 URL 创建节点 ==========
  const addNodeFromUrl = useCallback(
    async (url: string) => {
      if (loading) return

      setLoading(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/metadata?url=${encodeURIComponent(url)}`,
        )

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '请求失败' }))
          throw new Error(err.error ?? `请求失败 (${res.status})`)
        }

        const data: MetadataResponse = await res.json()

        const newNode: UrlNodeType = {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'urlNode',
          position: getNextPosition(nodesRef.current),
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
    [loading],
  )

  // ========== 根据文件创建节点 ==========
  const addNodeFromFile = useCallback(
    async (file: File) => {
      if (loading) return
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        setError('仅支持图片和视频文件')
        setTimeout(() => setError(null), 3000)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const result = await uploadFile(file)

        const newNode: ImageNodeType | VideoNodeType = {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: result.mediaType === 'video' ? 'videoNode' : 'imageNode',
          position: getNextPosition(nodesRef.current),
          data: {
            src: result.src,
            fileName: result.fileName,
          },
        }

        setNodes((prev) => [...prev, newNode])
        persistNode(newNode)
      } catch (err) {
        setError(err instanceof Error ? err.message : '上传失败')
        setTimeout(() => setError(null), 3000)
      } finally {
        setLoading(false)
      }
    },
    [loading],
  )

  // ========== 全局粘贴事件 ==========
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      // 如果焦点在输入框中则跳过
      if (
        inputRef.current &&
        inputRef.current === document.activeElement
      ) {
        return
      }

      // 优先检查文件（图片/视频）
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        e.preventDefault()
        addNodeFromFile(files[0])
        return
      }

      // 回退到文本 URL
      const text = e.clipboardData?.getData('text')?.trim()
      if (text && isValidUrl(text)) {
        e.preventDefault()
        addNodeFromUrl(text)
      }
    },
    [addNodeFromUrl, addNodeFromFile],
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
        addNodeFromFile(files[0])
      }
    },
    [addNodeFromFile],
  )

  // ========== 输入框回车提交 ==========
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const value = e.currentTarget.value.trim()
        if (value && isValidUrl(value)) {
          addNodeFromUrl(value)
          e.currentTarget.value = ''
        } else if (value) {
          setError('请输入有效的网址')
          setTimeout(() => setError(null), 3000)
        }
      }
    },
    [addNodeFromUrl],
  )

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
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>

      {/* 顶部浮动输入栏 */}
      <div className="url-input-bar">
        <input
          ref={inputRef}
          type="text"
          placeholder="粘贴或输入网址，按回车创建节点..."
          onKeyDown={handleInputKeyDown}
          disabled={loading}
        />
        {loading && <span className="loading-indicator">处理中...</span>}
      </div>

      {/* 错误提示 */}
      {error && <div className="error-toast">{error}</div>}

      {/* 空状态提示 */}
      {initialized && nodes.length === 0 && !loading && (
        <div className="empty-hint">
          <p>🌐 粘贴网址、图片或视频到画布上</p>
          <p className="empty-hint-sub">支持 Ctrl+V / ⌘+V 粘贴，或拖拽文件</p>
        </div>
      )}
    </div>
  )
}

export default App
