import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../stores/canvasStore'
import { useUIStore } from '../stores/uiStore'
import { useInputStore } from '../stores/inputStore'
import type {
  AppNode,
  UrlNodeType,
  ImageNodeType,
  TextNodeType,
  MetadataResponse,
} from '../types'
import {
  isDangerousFile,
  persistNode,
  localWaterfallLayout,
  getImageFileHeight,
  getVideoFileHeight,
  uploadFileChunked,
  registerUploadController,
  cancelUpload,
} from '../utils'

/**
 * 节点操作 hook — URL + 文件上传 + AI 生图
 * 需要 screenToFlowPosition，必须在 <ReactFlowProvider> 内使用
 */
export function useNodeActions() {
  const { screenToFlowPosition } = useReactFlow()

  // ========== URL 节点 ==========
  const addNodeFromUrl = useCallback(
    async (url: string) => {
      const { loading } = useCanvasStore.getState()
      if (loading) return

      if (url.length > 2048) {
        useUIStore.getState().showError('URL 过长，请缩短后重试')
        return
      }

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
          id: crypto.randomUUID(),
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

  // ========== 文本节点 ==========
  const addNodeFromText = useCallback(
    (text: string) => {
      const mouse = useInputStore.getState().mousePosition
      const pos = screenToFlowPosition(mouse)

      const newNode: TextNodeType = {
        id: crypto.randomUUID(),
        type: 'textNode',
        position: pos,
        data: {
          description: text,
        },
      }

      useCanvasStore.getState().setNodes((prev) => [...prev, newNode])
      persistNode(newNode)
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

      // 阶段 1：预计算高度，立即创建所有进度节点
      const uploadItems: {
        file: File
        nodeId: string
        pos: { x: number; y: number }
        isVideo: boolean
        isImage: boolean
      }[] = []

      for (const file of validFiles) {
        const isVideo = file.type.startsWith('video/')
        const isImage = file.type.startsWith('image/')

        let nodeHeight = 80
        if (isImage) {
          nodeHeight = await getImageFileHeight(file)
        } else if (isVideo) {
          nodeHeight = await getVideoFileHeight(file)
        }

        const pos = layout.next(nodeHeight)
        const nodeId = crypto.randomUUID()

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
        uploadItems.push({ file, nodeId, pos, isVideo, isImage })
      }

      // 阶段 2：串行上传每个文件
      for (const item of uploadItems) {
        const controller = new AbortController()
        registerUploadController(item.nodeId, controller)

        try {
          const result = await uploadFileChunked(item.file, {
            onProgress: (progress) => {
              useCanvasStore.getState().setNodes((prev) =>
                prev.map((n) => {
                  if (n.id !== item.nodeId || n.type === 'urlNode' || n.type === 'groupNode' || n.type === 'textNode') return n
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
                      uploading: { progress, fileName: item.file.name },
                    },
                  } as AppNode
                }),
              )
            },
            signal: controller.signal,
          })

          // 上传完成 → 转为正常节点
          const nodeType =
            result.mediaType === 'video'
              ? ('videoNode' as const)
              : result.mediaType === 'image'
                ? ('imageNode' as const)
                : ('docNode' as const)

          useCanvasStore.getState().setNodes((prev) =>
            prev.map((n): AppNode => {
              if (n.id !== item.nodeId) return n
              if (nodeType === 'docNode') {
                return {
                  ...n,
                  type: 'docNode',
                  data: {
                    src: result.src,
                    fileName: result.fileName,
                    fileSize: item.file.size,
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
            }),
          )

          const persistData =
            nodeType === 'docNode'
              ? {
                  src: result.src,
                  fileName: result.fileName,
                  fileSize: item.file.size,
                }
              : { src: result.src, fileName: result.fileName }

          persistNode({
            id: item.nodeId,
            type: nodeType,
            position: item.pos,
            data: persistData,
          } as AppNode)
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            useCanvasStore.getState().setNodes((prev) =>
              prev.filter((n) => n.id !== item.nodeId),
            )
          } else {
            useUIStore
              .getState()
              .showError(err instanceof Error ? err.message : '上传失败')
            useCanvasStore.getState().setNodes((prev) =>
              prev.filter((n) => n.id !== item.nodeId),
            )
          }
        } finally {
          cancelUpload(item.nodeId)
        }
      }
    },
    [],
  )

  // ========== AI 生图 ==========
  const handleAIGenerate = useCallback(async () => {
    const { aiPrompt, aiGenerating } = useUIStore.getState()
    if (!aiPrompt.trim() || aiGenerating) return

    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const nodeId = crypto.randomUUID()

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
      await new Promise((r) => setTimeout(r, 3000))

      const placeholderSrc =
        'https://placehold.co/640x640/1a1a2e/818cf8?text=AI+Generated'
      const promptText = useUIStore.getState().aiPrompt.trim().slice(0, 50)

      useCanvasStore.getState().setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n
          return {
            ...n,
            type: 'imageNode' as const,
            data: {
              src: placeholderSrc,
              fileName: `AI: ${promptText}`,
            },
          }
        }),
      )

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

  return { addNodeFromUrl, addNodeFromText, addNodeFromFiles, handleAIGenerate }
}
