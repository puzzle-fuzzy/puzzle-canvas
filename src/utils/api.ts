import type { AppNode } from '../types'
import { useAuthStore } from '../stores/authStore'

/**
 * 获取 API URL
 *
 * 开发环境和生产环境都使用相对路径，由 Vite 代理（dev）或
 * Hono 静态服务（prod）转发到后端。保持同源，避免 CORS 问题，
 * 确保 httpOnly cookie 正常读写。
 */
export function getApiUrl(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

/**
 * 带认证的 fetch 包装器
 *
 * 自动注入 Authorization header，收到 401 时尝试刷新 token 并重试。
 * 刷新失败时清除认证状态并弹出登录弹窗。
 */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken } = useAuthStore.getState()

  // 注入 Authorization header
  const headers = new Headers(options.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
  // 如果没有手动设置 Content-Type 且不是 FormData，默认 JSON
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  let response = await fetch(getApiUrl(path), {
    ...options,
    headers,
    credentials: 'include',
  })

  // 收到 401 → 尝试刷新 token
  if (response.status === 401 && accessToken) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      // 用新 token 重试原请求
      headers.set('Authorization', `Bearer ${refreshed}`)
      response = await fetch(getApiUrl(path), {
        ...options,
        headers,
        credentials: 'include',
      })
    }
  }

  return response
}

/** 当前进行中的 refresh 请求（去重：多个 401 并发时只发一次刷新） */
let tokenRefreshInFlight: Promise<string | null> | null = null

/** 尝试刷新 access token，成功返回新 token，失败返回 null */
function tryRefreshToken(): Promise<string | null> {
  if (tokenRefreshInFlight) return tokenRefreshInFlight

  tokenRefreshInFlight = _doTokenRefresh()
  tokenRefreshInFlight.finally(() => { tokenRefreshInFlight = null })

  return tokenRefreshInFlight
}

async function _doTokenRefresh(): Promise<string | null> {
  try {
    const res = await fetch(getApiUrl('/api/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    })

    if (!res.ok) return null

    const data = await res.json()
    if (!data.accessToken) return null

    useAuthStore.getState().setAccessToken(data.accessToken)
    return data.accessToken
  } catch {
    return null
  }
}

/** 持久化：创建节点到后端（fire-and-forget） */
export function persistNode(node: AppNode): void {
  authFetch('/api/nodes', {
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
  authFetch(`/api/nodes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ positionX: x, positionY: y }),
  }).catch((err) => console.error('Failed to persist position:', err))
}

/** 持久化：删除节点（fire-and-forget） */
export function persistNodeDelete(id: string): void {
  authFetch(`/api/nodes/${id}`, {
    method: 'DELETE',
  }).catch((err) => console.error('Failed to persist delete:', err))
}

/** 持久化：更新节点的 groupId（fire-and-forget） */
export function persistNodeGroupId(nodeId: string, groupId: string | null): void {
  authFetch(`/api/nodes/${nodeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId }),
  }).catch((err) => console.error('Failed to persist groupId:', err))
}

/** 持久化：更新小组节点属性（fire-and-forget） */
export function persistGroupUpdate(id: string, updates: { label?: string; width?: number; height?: number }): void {
  const body: Record<string, unknown> = {}
  if (updates.label !== undefined) body.title = updates.label
  if (updates.width !== undefined) body.width = updates.width
  if (updates.height !== undefined) body.height = updates.height
  authFetch(`/api/nodes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => console.error('Failed to persist group update:', err))
}

/** 从后端加载当前用户的所有节点 */
export async function loadNodes(): Promise<AppNode[]> {
  try {
    const res = await authFetch('/api/nodes')
    if (!res.ok) return []

    const rows = await res.json()

    const mapped: AppNode[] = rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      type: row.type as AppNode['type'],
      position: { x: row.positionX as number, y: row.positionY as number },
      ...(row.type === 'groupNode' ? { selectable: false } : {}),
      data: row.type === 'groupNode'
        ? {
            label: (row.title as string) ?? '',
            width: (row.width as number) ?? 0,
            height: (row.height as number) ?? 0,
          }
        : row.type === 'urlNode'
          ? {
              url: row.url as string,
              title: row.title as string,
              description: (row.description as string) ?? '',
              image: (row.image as string) ?? null,
              favicon: (row.favicon as string) ?? null,
              groupId: (row.groupId as string) ?? undefined,
            }
          : row.type === 'docNode'
            ? {
                src: row.src as string,
                fileName: row.fileName as string,
                fileSize: (row.fileSize as number) ?? 0,
                groupId: (row.groupId as string) ?? undefined,
              }
            : {
                src: row.src as string,
                fileName: row.fileName as string,
                groupId: (row.groupId as string) ?? undefined,
              },
    }))
    // 小组节点排在前面（渲染层级更低，避免遮挡内容节点）
    const groups = mapped.filter((n) => n.type === 'groupNode')
    const others = mapped.filter((n) => n.type !== 'groupNode')
    return [...groups, ...others]
  } catch {
    return []
  }
}
