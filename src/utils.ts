import type { AppNode } from './types'

const GAP = 16
const COL_COUNT = 3
const MEDIA_NODE_WIDTH = 320

/**
 * 局部瀑布流布局生成器
 * 给定起始坐标，每次调用 next(height) 传入实际节点高度
 * 在起始点附近按 3 列瀑布流排列，互不重叠
 */
function localWaterfallLayout(origin: { x: number; y: number }) {
  const stepX = MEDIA_NODE_WIDTH + GAP
  const colTops: number[] = new Array(COL_COUNT).fill(origin.y)

  return {
    next(height: number): { x: number; y: number } {
      // 找最矮列
      let minCol = 0
      for (let i = 1; i < COL_COUNT; i++) {
        if (colTops[i] < colTops[minCol]) minCol = i
      }
      const pos = {
        x: origin.x + minCol * stepX,
        y: colTops[minCol],
      }
      colTops[minCol] += height + GAP
      return pos
    },
  }
}

/** 加载图片获取渲染高度（宽度固定 320px） */
function getImageRenderHeight(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ratio = img.naturalHeight / img.naturalWidth
      resolve(Math.round(MEDIA_NODE_WIDTH * ratio))
    }
    img.onerror = () => resolve(MEDIA_NODE_WIDTH) // fallback 正方形
    img.src = src
  })
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

/** 获取 API 基础 URL（开发环境直连后端，避免 Vite 代理问题） */
function getApiUrl(path: string): string {
  if (import.meta.env.DEV) {
    return `http://localhost:3001${path}`
  }
  return path
}

/** 上传文件到后端 */
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
    type: row.type as 'urlNode' | 'imageNode' | 'videoNode',
    position: { x: row.positionX as number, y: row.positionY as number },
    data: row.type === 'urlNode'
      ? {
          url: row.url as string,
          title: row.title as string,
          description: (row.description as string) ?? '',
          image: (row.image as string) ?? null,
          favicon: (row.favicon as string) ?? null,
        }
      : {
          src: row.src as string,
          fileName: row.fileName as string,
        },
  }))
}

export {
  isValidUrl,
  getDomain,
  localWaterfallLayout,
  getImageRenderHeight,
  uploadFile,
  getApiUrl,
  persistNode,
  persistNodePosition,
  persistNodeDelete,
  loadNodes,
}
