import type { AppNode } from './types'

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

/** 计算新节点的放置位置（网格布局，避免堆叠） */
function getNextPosition(nodes: AppNode[]): { x: number; y: number } {
  const CARD_WIDTH = 280
  const GAP = 40
  const STEP_X = CARD_WIDTH + GAP
  const STEP_Y = 320
  const MAX_X = 960 // 大约 3 列

  if (nodes.length === 0) {
    return { x: 50, y: 50 }
  }

  // 计算每个网格位置是否被占用
  const occupied = new Set<string>()
  for (const node of nodes) {
    const col = Math.round((node.position.x - 50) / STEP_X)
    const row = Math.round((node.position.y - 50) / STEP_Y)
    occupied.add(`${col},${row}`)
  }

  // 找到第一个空位
  for (let row = 0; row < 100; row++) {
    for (let col = 0; col < Math.ceil(MAX_X / STEP_X); col++) {
      if (!occupied.has(`${col},${row}`)) {
        return { x: 50 + col * STEP_X, y: 50 + row * STEP_Y }
      }
    }
  }

  // fallback
  return { x: 50, y: 50 }
}

/** 上传文件到后端 */
async function uploadFile(file: File): Promise<{
  src: string
  fileName: string
  mediaType: 'image' | 'video'
}> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '上传失败' }))
    throw new Error(err.error ?? `上传失败 (${res.status})`)
  }

  return await res.json()
}

export { isValidUrl, getDomain, getNextPosition, uploadFile }
