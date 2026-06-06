import { create } from 'zustand'

/**
 * 认证用户类型（与后端 PublicUser 对应）
 */
export type AuthUser = {
  id: string
  email: string
  username: string
  role: 'admin' | 'member'
  avatar: string | null
}

/**
 * 认证 Store
 *
 * 管理 currentUser、accessToken（内存）和认证状态。
 * accessToken 仅存于 Zustand 内存中，不持久化到 localStorage 或 cookie。
 * refresh token 由浏览器 httpOnly cookie 自动管理。
 */
interface AuthStore {
  // ========== State ==========
  user: AuthUser | null
  isAuthenticated: boolean
  accessToken: string | null
  loading: boolean

  // ========== Actions ==========
  /** 登录成功后设置用户和 token */
  setAuth: (user: AuthUser, accessToken: string) => void
  /** 仅更新 access token（刷新时使用） */
  setAccessToken: (token: string) => void
  /** 登出时清除所有认证状态 */
  clearAuth: () => void
  /** 设置初始加载状态 */
  setLoading: (v: boolean) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  // ========== State ==========
  user: null,
  isAuthenticated: false,
  accessToken: null,
  loading: true,

  // ========== Actions ==========
  setAuth: (user, accessToken) => set({
    user,
    accessToken,
    isAuthenticated: true,
    loading: false,
  }),

  setAccessToken: (token) => set({ accessToken: token }),

  clearAuth: () => set({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    loading: false,
  }),

  setLoading: (v) => set({ loading: v }),
}))
