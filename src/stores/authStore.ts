import { create } from 'zustand'

/**
 * 认证 store — 骨架，后续接入账号系统时扩展
 */
interface AuthStore {
  user: null // 未来: User | null
  isAuthenticated: boolean
}

export const useAuthStore = create<AuthStore>(() => ({
  user: null,
  isAuthenticated: false,
}))
