import type { AppNode, UploadInitResponse } from './types'

const GAP_X = 16
const GAP_Y = 36
const COL_COUNT = 3
const NODE_WIDTH = 320

/** 选区瀑布流布局参数（与上传多文件瀑布流一致） */
const SEL_GAP_X = GAP_X
const SEL_GAP_Y = GAP_Y
const SEL_COL_COUNT = COL_COUNT

/**
 * 局部瀑布流布局生成器
 * 给定起始坐标，每次调用 next(height) 传入实际节点高度
 * 在起始点附近按 3 列瀑布流排列，互不重叠
 */
function localWaterfallLayout(origin: { x: number; y: number }) {
  const stepX = NODE_WIDTH + GAP_X
  const colTops: number[] = new Array(COL_COUNT).fill(origin.y)

  return {
    next(height: number): { x: number; y: number } {
      let minCol = 0
      for (let i = 1; i < COL_COUNT; i++) {
        if (colTops[i] < colTops[minCol]) minCol = i
      }
      const pos = {
        x: origin.x + minCol * stepX,
        y: colTops[minCol],
      }
      colTops[minCol] += height + GAP_Y
      return pos
    },
  }
}

/**
 * 选区瀑布流布局
 * 给定一组已选节点，以它们包围盒左上角为原点
 * 按 3 列 masonry 排列，返回每个节点的新位置
 */
function selectionWaterfallLayout(
  nodes: AppNode[],
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>()
  if (nodes.length === 0) return result

  // 包围盒左上角作为起点
  const minX = Math.min(...nodes.map((n) => n.position.x))
  const minY = Math.min(...nodes.map((n) => n.position.y))

  // 获取节点默认尺寸（所有节点宽度统一 320px）
  const defaultSize = (n: AppNode) => {
    if (n.measured?.width && n.measured?.height) return n.measured
    return { width: NODE_WIDTH, height: 200 }
  }

  // 按高度降序排列，让大块先放，布局更紧凑
  const sorted = [...nodes].sort((a, b) => {
    const hA = defaultSize(a).height
    const hB = defaultSize(b).height
    return hB - hA
  })

  // 列宽取最宽节点
  const maxWidth = Math.max(...nodes.map((n) => defaultSize(n).width))
  const colStep = maxWidth + SEL_GAP_X
  const colTops: number[] = new Array(SEL_COL_COUNT).fill(minY)

  for (const node of sorted) {
    const { height } = defaultSize(node)

    // 找最短列
    let minCol = 0
    for (let i = 1; i < SEL_COL_COUNT; i++) {
      if (colTops[i] < colTops[minCol]) minCol = i
    }

    result.set(node.id, {
      x: minX + minCol * colStep,
      y: colTops[minCol],
    })
    colTops[minCol] += height + SEL_GAP_Y
  }

  return result
}

/** 加载图片获取渲染高度（宽度固定 320px） */
function getImageRenderHeight(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ratio = img.naturalHeight / img.naturalWidth
      resolve(Math.round(NODE_WIDTH * ratio))
    }
    img.onerror = () => resolve(NODE_WIDTH)
    img.src = src
  })
}

/** 从本地 File 预计算图片渲染高度 */
function getImageFileHeight(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const ratio = img.naturalHeight / img.naturalWidth
      resolve(Math.round(NODE_WIDTH * ratio))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(NODE_WIDTH)
    }
    img.src = url
  })
}

/** 从本地 File 预计算视频渲染高度 */
function getVideoFileHeight(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const ratio = video.videoHeight / video.videoWidth
      resolve(Math.round(NODE_WIDTH * (ratio || 1)))
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(NODE_WIDTH)
    }
    video.src = url
  })
}

/** 危险文件扩展名（与后端一致） */
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'dll', 'sys', 'vxd',
  'vbs', 'vbe', 'wsf', 'wsh', 'ps1', 'psm1',
  'jar', 'class',
  'inf', 'reg', 'lnk', 'desktop',
  'app', 'dmg', 'pkg',
  'iso', 'img',
  'hta', 'cpl',
])

/** 判断文件是否为危险类型（检查所有扩展名，防止双扩展名绕过） */
function isDangerousFile(fileName: string): boolean {
  const parts = fileName.toLowerCase().split('.')
  // 检查每个扩展名段（跳过第一个，它是文件名主体）
  for (let i = 1; i < parts.length; i++) {
    if (DANGEROUS_EXTENSIONS.has(parts[i])) return true
  }
  return false
}

/** 校验字符串是否为合法 HTTP/HTTPS URL */
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

/** 从 URL 提取域名用于显示 */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** 获取 API URL（开发环境直连后端） */
function getApiUrl(path: string): string {
  if (import.meta.env.DEV) {
    return `http://localhost:3001${path}`
  }
  return path
}

/** 上传文件到后端（旧接口，保留兼容） */
async function uploadFile(file: File): Promise<{
  src: string
  fileName: string
  mediaType: 'image' | 'video'
}> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(getApiUrl('/api/upload'), {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '上传失败' }))
    throw new Error(err.error ?? `上传失败 (${res.status})`)
  }

  return await res.json()
}

// ========== 分片上传 ==========

const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB

/** 计算文件指纹：SHA-256(前 2MB) + fileSize */
async function computeFileFingerprint(file: File): Promise<string> {
  const sampleSize = Math.min(2 * 1024 * 1024, file.size)
  const sample = await file.slice(0, sampleSize).arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', sample)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex}-${file.size}`
}

/** 上传控制器（按 nodeId 存储） */
const uploadControllers = new Map<string, AbortController>()

function registerUploadController(nodeId: string, controller: AbortController) {
  uploadControllers.set(nodeId, controller)
}

/** 取消指定节点的上传 */
function cancelUpload(nodeId: string) {
  const controller = uploadControllers.get(nodeId)
  if (controller) {
    controller.abort()
    uploadControllers.delete(nodeId)
  }
}

/** 分片上传：带进度、重试、断点续传 */
async function uploadFileChunked(
  file: File,
  options: {
    onProgress?: (progress: number) => void
    signal?: AbortSignal
  } = {},
): Promise<{ src: string; fileName: string; mediaType: 'image' | 'video' }> {
  const { onProgress, signal } = options

  // 1. 计算指纹
  const fingerprint = await computeFileFingerprint(file)
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE))

  // 2. 初始化
  signal?.throwIfAborted()
  const initRes = await fetch(getApiUrl('/api/upload/init'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      fingerprint,
    }),
    signal,
  })
  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({ error: '上传初始化失败' }))
    throw new Error(err.error ?? `上传初始化失败 (${initRes.status})`)
  }
  const { uploadId, existingChunks }: UploadInitResponse = await initRes.json()
  const uploadedSet = new Set(existingChunks)

  // 3. 逐片上传（跳过已有分片）
  for (let i = 0; i < totalChunks; i++) {
    signal?.throwIfAborted()

    // 断点续传：跳过已上传的分片
    if (uploadedSet.has(i)) {
      onProgress?.((i + 1) / totalChunks)
      continue
    }

    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunkBlob = file.slice(start, end)

    // 重试逻辑（3 次，指数退避）
    const MAX_RETRIES = 3
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      signal?.throwIfAborted()
      try {
        const formData = new FormData()
        formData.append('uploadId', uploadId)
        formData.append('chunkIndex', String(i))
        formData.append('chunk', chunkBlob, file.name)

        const chunkRes = await fetch(getApiUrl('/api/upload/chunk'), {
          method: 'PUT',
          body: formData,
          signal,
        })

        if (chunkRes.ok) {
          lastError = null
          break
        }
        lastError = new Error(`分片 ${i} 上传失败 (${chunkRes.status})`)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }

      // 等待后重试（指数退避 1s, 2s, 4s）
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
      }
    }

    if (lastError) throw lastError

    onProgress?.((i + 1) / totalChunks)
  }

  // 4. 完成合并
  signal?.throwIfAborted()
  const completeRes = await fetch(getApiUrl('/api/upload/complete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, fileName: file.name }),
    signal,
  })
  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({ error: '合并失败' }))
    throw new Error(err.error ?? `合并失败 (${completeRes.status})`)
  }

  return await completeRes.json()
}

/** 持久化：创建节点到后端（fire-and-forget） */
function persistNode(node: AppNode): void {
  fetch(getApiUrl('/api/nodes'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: node.id,
      type: node.type,
      positionX: node.position.x,
      positionY: node.position.y,
      ...node.data,
    }),
  }).catch((err) => console.error('Failed to persist node:', err))
}

/** 持久化：更新节点位置（fire-and-forget） */
function persistNodePosition(id: string, x: number, y: number): void {
  fetch(getApiUrl(`/api/nodes/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ positionX: x, positionY: y }),
  }).catch((err) => console.error('Failed to persist position:', err))
}

/** 持久化：删除节点（fire-and-forget） */
function persistNodeDelete(id: string): void {
  fetch(getApiUrl(`/api/nodes/${id}`), {
    method: 'DELETE',
  }).catch((err) => console.error('Failed to persist delete:', err))
}

/** 从后端加载所有节点 */
async function loadNodes(): Promise<AppNode[]> {
  const res = await fetch(getApiUrl('/api/nodes'))
  if (!res.ok) return []

  const rows = await res.json()

  return rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type: row.type as 'urlNode' | 'imageNode' | 'videoNode' | 'docNode',
    position: { x: row.positionX as number, y: row.positionY as number },
    data: row.type === 'urlNode'
      ? {
          url: row.url as string,
          title: row.title as string,
          description: (row.description as string) ?? '',
          image: (row.image as string) ?? null,
          favicon: (row.favicon as string) ?? null,
        }
      : row.type === 'docNode'
        ? {
            src: row.src as string,
            fileName: row.fileName as string,
            fileSize: (row.fileSize as number) ?? 0,
          }
        : {
            src: row.src as string,
            fileName: row.fileName as string,
          },
  }))
}

export {
  isValidUrl,
  isDangerousFile,
  getDomain,
  localWaterfallLayout,
  selectionWaterfallLayout,
  getImageRenderHeight,
  getImageFileHeight,
  getVideoFileHeight,
  uploadFile,
  uploadFileChunked,
  registerUploadController,
  cancelUpload,
  getApiUrl,
  persistNode,
  persistNodePosition,
  persistNodeDelete,
  loadNodes,
  NODE_WIDTH,
}
