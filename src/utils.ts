import type { AppNode } from './types'

const GAP_X = 16
const GAP_Y = 36
const COL_COUNT = 3
const MEDIA_NODE_WIDTH = 320

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
  const stepX = MEDIA_NODE_WIDTH + GAP_X
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

  // 获取节点默认尺寸
  const defaultSize = (n: AppNode) => {
    if (n.measured?.width && n.measured?.height) return n.measured
    return n.type === 'urlNode'
      ? { width: 280, height: 200 }
      : { width: 320, height: 200 }
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
      resolve(Math.round(MEDIA_NODE_WIDTH * ratio))
    }
    img.onerror = () => resolve(MEDIA_NODE_WIDTH)
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

/** 获取 API URL（开发环境直连后端） */
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
  selectionWaterfallLayout,
  getImageRenderHeight,
  uploadFile,
  getApiUrl,
  persistNode,
  persistNodePosition,
  persistNodeDelete,
  loadNodes,
}
