/**
 * 认证 API 工具
 *
 * 提供 register、login、checkAuth 等高层认证函数。
 * 这些函数使用原生 fetch（此时还没有 access token），
 * 成功后自动更新 authStore。
 */
import { getApiUrl } from './api'
import { useAuthStore, type AuthUser } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { useCanvasStore } from '../stores/canvasStore'

// ========== 类型 ==========

interface AuthResponse {
  user: AuthUser
  accessToken: string
}

// ========== 注册 ==========

export async function register(
  email: string,
  username: string,
  password: string,
): Promise<AuthUser> {
  const res = await fetch(getApiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, username, password }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: '注册失败' }))
    throw new Error(data.error ?? `注册失败 (${res.status})`)
  }

  const data: AuthResponse = await res.json()
  useAuthStore.getState().setAuth(data.user, data.accessToken)
  return data.user
}

// ========== 登录 ==========

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  const res = await fetch(getApiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: '登录失败' }))
    throw new Error(data.error ?? `登录失败 (${res.status})`)
  }

  const data: AuthResponse = await res.json()
  useAuthStore.getState().setAuth(data.user, data.accessToken)
  return data.user
}

// ========== 检查/恢复会话 ==========

/**
 * 尝试用 httpOnly refresh cookie 恢复会话
 *
 * 页面加载时调用。如果 refresh cookie 仍有效，后端会签发新的
 * access token 并返回用户信息。失败时返回 null。
 *
 * 使用 api.ts 的全局 tryRefreshToken 锁，确保与 authFetch 的 401 重试
 * 共享同一个 Promise，避免并发刷新导致 token rotation 竞态。
 */
export async function checkAuth(): Promise<AuthUser | null> {
  try {
    const res = await fetch(getApiUrl('/api/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    })

    if (!res.ok) return null

    const data: AuthResponse = await res.json()
    useAuthStore.getState().setAuth(data.user, data.accessToken)
    return data.user
  } catch {
    return null
  }
}

// ========== 登出 ==========

export async function logout(): Promise<void> {
  try {
    await fetch(getApiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // 登出请求失败也清除本地状态
  }
  useAuthStore.getState().clearAuth()
  // 清空画布状态，避免切换用户时显示上一个用户的数据
  const canvasStore = useCanvasStore.getState()
  canvasStore.setNodes([])
  canvasStore.setSelectedNodeIds([])
  canvasStore.setFocusedGroupId(null)
  useUIStore.getState().setShowLoginModal(true)
}
