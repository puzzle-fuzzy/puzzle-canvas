import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../stores/canvasStore'
import { useUIStore } from '../stores/uiStore'
import { useInputStore } from '../stores/inputStore'
import type {
  AppNode,
  UrlNodeType,
  ImageNodeType,
  MetadataResponse,
} from '../types'
import {
  isValidUrl,
  isDangerousFile,
  persistNode,
  persistNodePosition,
  localWaterfallLayout,
  getImageFileHeight,
  getVideoFileHeight,
  getApiUrl,
  uploadFileChunked,
  registerUploadController,
  cancelUpload,
} from '../utils'

/**
 * 画布操作 hook — 桥接 ReactFlow hooks 与 zustand stores
 * 所有需要 screenToFlowPosition / getViewport 的异步回调都在这里
 */
export function useCanvasActions() {
  const { screenToFlowPosition, getViewport } = useReactFlow()

  // ========== URL 节点 ==========
  const addNodeFromUrl = useCallback(
    async (url: string) => {
      const { loading } = useCanvasStore.getState()
      if (loading) return

      useCanvasStore.getState().setLoading(true)
      useUIStore.getState().setError(null)

      try {
        const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: '请求失败' }))
          throw new Error(err.error ?? `请求失败 (${res.status})`)
        }

        const data: MetadataResponse = await res.json()
        const mouse = useInputStore.getState().mousePosition
        const pos = screenToFlowPosition(mouse)

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

        useCanvasStore.getState().setNodes((prev) => [...prev, newNode])
        persistNode(newNode)
      } catch (err) {
        useUIStore.getState().showError(
          err instanceof Error ? err.message : '发生未知错误',
        )
      } finally {
        useCanvasStore.getState().setLoading(false)
      }
    },
    [screenToFlowPosition],
  )

  // ========== 文件节点（分片上传 + 进度节点）==========
  const addNodeFromFiles = useCallback(
    async (files: FileList | File[], origin: { x: number; y: number }) => {
      const allFiles = Array.from(files)
      const validFiles = allFiles.filter((f) => !isDangerousFile(f.name))
      if (validFiles.length === 0) {
        useUIStore.getState().showError('不支持的文件类型')
        return
      }

      useUIStore.getState().setError(null)
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

        useCanvasStore.getState().setNodes((prev) => [...prev, newNode])

        // 串行链式上传
        const currentFile = file
        const currentNodeId = nodeId

        uploadChain = uploadChain.then(() => {
          const controller = new AbortController()
          registerUploadController(currentNodeId, controller)

          return uploadFileChunked(currentFile, {
            onProgress: (progress) => {
              useCanvasStore.getState().setNodes((prev) =>
                prev.map((n) => {
                  if (n.id !== currentNodeId || n.type === 'urlNode') return n
                  const nodeData =
                    n.type === 'docNode'
                      ? {
                          src: n.data.src,
                          fileName: n.data.fileName,
                          fileSize: n.data.fileSize,
                        }
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
              const nodeType =
                result.mediaType === 'video'
                  ? ('videoNode' as const)
                  : result.mediaType === 'image'
                    ? ('imageNode' as const)
                    : ('docNode' as const)

              useCanvasStore.getState().setNodes((prev) => {
                const updated = prev.map((n): AppNode => {
                  if (n.id !== currentNodeId) return n
                  if (nodeType === 'docNode') {
                    return {
                      ...n,
                      type: 'docNode',
                      data: {
                        src: result.src,
                        fileName: result.fileName,
                        fileSize: currentFile.size,
                      },
                    }
                  }
                  if (nodeType === 'videoNode') {
                    return {
                      ...n,
                      type: 'videoNode',
                      data: { src: result.src, fileName: result.fileName },
                    }
                  }
                  return {
                    ...n,
                    type: 'imageNode',
                    data: { src: result.src, fileName: result.fileName },
                  }
                })
                return updated
              })

              const persistData =
                nodeType === 'docNode'
                  ? {
                      src: result.src,
                      fileName: result.fileName,
                      fileSize: currentFile.size,
                    }
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
                useCanvasStore.getState().setNodes((prev) =>
                  prev.filter((n) => n.id !== currentNodeId),
                )
              } else {
                // 失败 → 移除节点 + 错误提示
                useUIStore
                  .getState()
                  .showError(
                    err instanceof Error ? err.message : '上传失败',
                  )
                useCanvasStore.getState().setNodes((prev) =>
                  prev.filter((n) => n.id !== currentNodeId),
                )
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

  // ========== AI 生图 ==========
  const handleAIGenerate = useCallback(async () => {
    const { aiPrompt, aiGenerating } = useUIStore.getState()
    if (!aiPrompt.trim() || aiGenerating) return

    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const nodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const generatingNode: ImageNodeType = {
      id: nodeId,
      type: 'imageNode',
      position: center,
      data: {
        src: '',
        fileName: `AI: ${aiPrompt.trim().slice(0, 50)}`,
        uploading: {
          progress: 0,
          fileName: `AI: ${aiPrompt.trim().slice(0, 50)}`,
        },
      },
    }

    useCanvasStore.getState().setNodes((prev) => [...prev, generatingNode])

    useUIStore.getState().setShowAIModal(false)
    useUIStore.getState().setAiGenerating(true)

    try {
      // TODO: 调用实际 AI 生图 API
      // 模拟生成过程（后端接入后移除）
      await new Promise((r) => setTimeout(r, 3000))

      const placeholderSrc =
        'https://placehold.co/640x640/1a1a2e/818cf8?text=AI+Generated'
      const promptText = useUIStore.getState().aiPrompt.trim().slice(0, 50)

      useCanvasStore.getState().setNodes((prev) => {
        const updated = prev.map((n) => {
          if (n.id !== nodeId) return n
          return {
            ...n,
            type: 'imageNode' as const,
            data: {
              src: placeholderSrc,
              fileName: `AI: ${promptText}`,
            },
          }
        })
        return updated
      })

      persistNode({
        id: nodeId,
        type: 'imageNode',
        position: center,
        data: { src: placeholderSrc, fileName: `AI: ${promptText}` },
      } as ImageNodeType)
    } catch (err) {
      useUIStore
        .getState()
        .showError(err instanceof Error ? err.message : 'AI 生图失败')
      useCanvasStore.getState().setNodes((prev) =>
        prev.filter((n) => n.id !== nodeId),
      )
    } finally {
      useUIStore.getState().setAiGenerating(false)
      useUIStore.getState().setAiPrompt('')
    }
  }, [screenToFlowPosition])

  // ========== 选区下载（图片/视频）==========
  const handleDownloadSelected = useCallback(async () => {
    const { nodes, selectedNodeIds } = useCanvasStore.getState()
    const selected = nodes.filter((n) => selectedNodeIds.includes(n.id))
    const downloadable = selected.filter(
      (n) =>
        n.type === 'imageNode' ||
        n.type === 'videoNode' ||
        n.type === 'docNode',
    ) as (import('../types').ImageNodeType | import('../types').VideoNodeType | import('../types').DocNodeType)[]

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
  }, [])

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
    addNodeFromUrl,
    addNodeFromFiles,
    handlePaste,
    handleDragOver,
    handleDrop,
    handleAIGenerate,
    handleMoveEnd,
    handleNodeDragStop,
    handleDownloadSelected,
  }
}
