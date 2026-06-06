import { useState, useCallback, useRef, useEffect } from 'react'
import { LayoutGrid, Download, Trash2, Hand, MousePointer2, Sparkles, X, Loader2 } from 'lucide-react'
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
import DocNode from './components/DocNode'
import type {
  AppNode,
  UrlNodeType,
  ImageNodeType,
  VideoNodeType,
  DocNodeType,
  MetadataResponse,
} from './types'
import {
  isValidUrl,
  isDangerousFile,
  persistNode,
  persistNodePosition,
  persistNodeDelete,
  loadNodes,
  localWaterfallLayout,
  selectionWaterfallLayout,
  getImageFileHeight,
  getVideoFileHeight,
  getApiUrl,
  NODE_WIDTH,
  uploadFileChunked,
  registerUploadController,
  cancelUpload,
} from './utils'
import './App.css'

const nodeTypes = {
  urlNode: UrlNode,
  imageNode: MediaNode,
  videoNode: MediaNode,
  docNode: DocNode,
}

function Canvas() {
  const [nodes, setNodes] = useState<AppNode[]>([])
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  // 'pan' = 拖拽画布（默认）, 'select' = 框选节点
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('pan')
  // AI 生图弹窗状态
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiModel, setAiModel] = useState('dall-e-3')
  const [aiGenerating, setAiGenerating] = useState(false)
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
          cancelUpload(change.id)
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
    if (selected.length < 1) return

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
    const downloadable = selected.filter(
      (n) => n.type === 'imageNode' || n.type === 'videoNode' || n.type === 'docNode',
    ) as (ImageNodeType | VideoNodeType | DocNodeType)[]

    if (downloadable.length === 0) return

    for (const node of downloadable) {
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

  // ========== 文件节点（分片上传 + 进度节点）==========
  const addNodeFromFiles = useCallback(
    async (files: FileList | File[], origin: { x: number; y: number }) => {
      const allFiles = Array.from(files)
      const validFiles = allFiles.filter((f) => !isDangerousFile(f.name))
      if (validFiles.length === 0) {
        setError('不支持的文件类型')
        setTimeout(() => setError(null), 3000)
        return
      }

      setError(null)
      const layout = localWaterfallLayout(origin)

      // 为每个文件预计算高度并立即创建进度节点，然后串行上传
      let uploadChain: Promise<void> = Promise.resolve()

      for (const file of validFiles) {
        const isVideo = file.type.startsWith('video/')
        const isImage = file.type.startsWith('image/')

        // 从本地文件预计算渲染高度，用于瀑布流定位
        let nodeHeight = 80 // 文档节点默认高度
        if (isImage) {
          nodeHeight = await getImageFileHeight(file)
        } else if (isVideo) {
          nodeHeight = await getVideoFileHeight(file)
        }

        const pos = layout.next(nodeHeight)
        const nodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        // 立即创建带进度的节点
        const newNode: AppNode = isVideo
          ? {
              id: nodeId,
              type: 'videoNode',
              position: pos,
              data: {
                src: '',
                fileName: file.name,
                uploading: { progress: 0, fileName: file.name },
              },
            }
          : isImage
            ? {
                id: nodeId,
                type: 'imageNode',
                position: pos,
                data: {
                  src: '',
                  fileName: file.name,
                  uploading: { progress: 0, fileName: file.name },
                },
              }
            : {
                id: nodeId,
                type: 'docNode',
                position: pos,
                data: {
                  src: '',
                  fileName: file.name,
                  fileSize: file.size,
                  uploading: { progress: 0, fileName: file.name },
                },
              }

        setNodes((prev) => {
          const updated = [...prev, newNode]
          nodesRef.current = updated
          return updated
        })

        // 串行链式上传
        const currentFile = file
        const currentNodeId = nodeId

        uploadChain = uploadChain.then(() => {
          const controller = new AbortController()
          registerUploadController(currentNodeId, controller)

          return uploadFileChunked(currentFile, {
            onProgress: (progress) => {
              setNodes((prev) =>
                prev.map((n) => {
                  if (n.id !== currentNodeId || n.type === 'urlNode') return n
                  const nodeData = n.type === 'docNode'
                    ? { src: n.data.src, fileName: n.data.fileName, fileSize: n.data.fileSize }
                    : { src: n.data.src, fileName: n.data.fileName }
                  return {
                    ...n,
                    data: {
                      ...nodeData,
                      uploading: { progress, fileName: currentFile.name },
                    },
                  } as AppNode
                }),
              )
            },
            signal: controller.signal,
          })
            .then((result) => {
              // 上传完成 → 转为正常节点
              const nodeType = result.mediaType === 'video' ? 'videoNode' as const
                : result.mediaType === 'image' ? 'imageNode' as const
                : 'docNode' as const

              setNodes((prev) => {
                const updated = prev.map((n): AppNode => {
                  if (n.id !== currentNodeId) return n
                  if (nodeType === 'docNode') {
                    return { ...n, type: 'docNode', data: { src: result.src, fileName: result.fileName, fileSize: currentFile.size } }
                  }
                  if (nodeType === 'videoNode') {
                    return { ...n, type: 'videoNode', data: { src: result.src, fileName: result.fileName } }
                  }
                  return { ...n, type: 'imageNode', data: { src: result.src, fileName: result.fileName } }
                })
                nodesRef.current = updated
                return updated
              })

              const persistData = nodeType === 'docNode'
                ? { src: result.src, fileName: result.fileName, fileSize: currentFile.size }
                : { src: result.src, fileName: result.fileName }

              persistNode({
                id: currentNodeId,
                type: nodeType,
                position: pos,
                data: persistData,
              } as AppNode)
            })
            .catch((err) => {
              if (err instanceof DOMException && err.name === 'AbortError') {
                // 取消 → 移除节点
                setNodes((prev) => {
                  const updated = prev.filter((n) => n.id !== currentNodeId)
                  nodesRef.current = updated
                  return updated
                })
              } else {
                // 失败 → 移除节点 + 错误提示
                setError(err instanceof Error ? err.message : '上传失败')
                setTimeout(() => setError(null), 3000)
                setNodes((prev) => {
                  const updated = prev.filter((n) => n.id !== currentNodeId)
                  nodesRef.current = updated
                  return updated
                })
              }
            })
            .finally(() => {
              cancelUpload(currentNodeId)
            })
        })
      }
    },
    [],
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
    if (selectedNodeIds.length < 1) return null
    const selected = nodesRef.current.filter((n) => selectedNodeIds.includes(n.id))
    if (selected.length === 0) return null

    let maxX = -Infinity
    let minY = Infinity
    for (const n of selected) {
      const w = n.measured?.width ?? NODE_WIDTH
      maxX = Math.max(maxX, n.position.x + w)
      minY = Math.min(minY, n.position.y)
    }

    const [vx, vy, zoom] = transform
    return {
      x: maxX * zoom + vx,
      y: minY * zoom + vy,
    }
  })()

  // ========== AI 生图 ==========
  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim() || aiGenerating) return

    // 在屏幕中间创建生成中的节点
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const nodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const generatingNode: ImageNodeType = {
      id: nodeId,
      type: 'imageNode',
      position: center,
      data: {
        src: '',
        fileName: `AI: ${aiPrompt.trim().slice(0, 50)}`,
        uploading: { progress: 0, fileName: `AI: ${aiPrompt.trim().slice(0, 50)}` },
      },
    }

    setNodes((prev) => {
      const updated = [...prev, generatingNode]
      nodesRef.current = updated
      return updated
    })

    setShowAIModal(false)
    setAiGenerating(true)

    try {
      // TODO: 调用实际 AI 生图 API
      // const res = await fetch(getApiUrl('/api/generate-image'), {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ prompt: aiPrompt, model: aiModel }),
      // })
      // const { src } = await res.json()

      // 模拟生成过程（后端接入后移除）
      await new Promise((r) => setTimeout(r, 3000))

      // 生成完成 → 替换为占位图
      const placeholderSrc = 'https://placehold.co/640x640/1a1a2e/818cf8?text=AI+Generated'

      setNodes((prev) => {
        const updated = prev.map((n) => {
          if (n.id !== nodeId) return n
          return { ...n, type: 'imageNode' as const, data: { src: placeholderSrc, fileName: `AI: ${aiPrompt.trim().slice(0, 50)}` } }
        })
        nodesRef.current = updated
        return updated
      })

      persistNode({
        id: nodeId,
        type: 'imageNode',
        position: center,
        data: { src: placeholderSrc, fileName: `AI: ${aiPrompt.trim().slice(0, 50)}` },
      } as ImageNodeType)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 生图失败')
      setTimeout(() => setError(null), 3000)
      setNodes((prev) => {
        const updated = prev.filter((n) => n.id !== nodeId)
        nodesRef.current = updated
        return updated
      })
    } finally {
      setAiGenerating(false)
      setAiPrompt('')
    }
  }, [aiPrompt, aiModel, aiGenerating, screenToFlowPosition])

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
        panOnDrag={interactionMode === 'pan'}
        selectionKeyCode={interactionMode === 'select' ? null : 'Space'}
        selectionOnDrag={interactionMode === 'select'}
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
          {selectedNodeIds.length > 1 && (
            <button className="selection-toolbar-btn" onClick={handleOrganize} title="整理">
              <LayoutGrid size={15} />
            </button>
          )}
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

      {/* AI 生图弹窗 */}
      {showAIModal && (
        <div className="ai-modal-overlay" onClick={() => !aiGenerating && setShowAIModal(false)}>
          <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <span className="ai-modal-title">
                <Sparkles size={16} />
                AI 生图
              </span>
              <button
                className="ai-modal-close"
                onClick={() => !aiGenerating && setShowAIModal(false)}
                disabled={aiGenerating}
              >
                <X size={16} />
              </button>
            </div>

            <textarea
              className="ai-modal-input"
              placeholder="描述你想要的图片..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
              disabled={aiGenerating}
            />

            <div className="ai-modal-row">
              <select
                className="ai-modal-select"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                disabled={aiGenerating}
              >
                <option value="dall-e-3">DALL·E 3</option>
                <option value="flux-1.1-pro">FLUX 1.1 Pro</option>
                <option value="stable-diffusion-xl">Stable Diffusion XL</option>
              </select>
              <button
                className="ai-modal-generate"
                onClick={handleAIGenerate}
                disabled={aiGenerating || !aiPrompt.trim()}
              >
                {aiGenerating ? (
                  <><Loader2 size={14} className="spin" /> 生成中...</>
                ) : '生成图片'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 右侧模式切换工具栏 */}
      <div className="mode-toolbar">
        <button
          className={`mode-toolbar-btn ${interactionMode === 'pan' ? 'active' : ''}`}
          onClick={() => setInteractionMode('pan')}
          title="拖拽模式（Space 切换）"
        >
          <Hand size={20} />
        </button>
        <button
          className={`mode-toolbar-btn ${interactionMode === 'select' ? 'active' : ''}`}
          onClick={() => setInteractionMode('select')}
          title="选择模式（Space 切换）"
        >
          <MousePointer2 size={20} />
        </button>
        <div className="mode-toolbar-divider" />
        <button
          className="mode-toolbar-btn"
          onClick={() => setShowAIModal(true)}
          title="AI 生图"
        >
          <Sparkles size={20} />
        </button>
      </div>
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
