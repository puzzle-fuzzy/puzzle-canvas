import type { AppNode } from '../types'

/** 获取 API URL（开发环境直连后端） */
export function getApiUrl(path: string): string {
  if (import.meta.env.DEV) {
    return `http://localhost:3001${path}`
  }
  return path
}

/** 持久化：创建节点到后端（fire-and-forget） */
export function persistNode(node: AppNode): void {
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
export function persistNodePosition(id: string, x: number, y: number): void {
  fetch(getApiUrl(`/api/nodes/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ positionX: x, positionY: y }),
  }).catch((err) => console.error('Failed to persist position:', err))
}

/** 持久化：删除节点（fire-and-forget） */
export function persistNodeDelete(id: string): void {
  fetch(getApiUrl(`/api/nodes/${id}`), {
    method: 'DELETE',
  }).catch((err) => console.error('Failed to persist delete:', err))
}

/** 从后端加载所有节点 */
export async function loadNodes(): Promise<AppNode[]> {
  try {
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
  } catch {
    return []
  }
}
