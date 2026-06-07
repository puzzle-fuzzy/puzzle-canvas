import { describe, it, expect, vi, beforeEach } from 'vitest'
import { register, login, checkAuth, logout } from './auth'
import { useAuthStore } from '../stores/authStore'
import { useCanvasStore } from '../stores/canvasStore'
import { useUIStore } from '../stores/uiStore'

describe('register', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useAuthStore.getState().clearAuth()
  })

  it('注册成功后更新 authStore', async () => {
    const mockUser = { id: '1', email: 'a@b.com', username: 'test', role: 'member' as const, avatar: null }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: mockUser, accessToken: 'token-123' }),
    }))

    const user = await register('a@b.com', 'test', 'password')
    expect(user).toEqual(mockUser)
    expect(useAuthStore.getState().accessToken).toBe('token-123')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('注册失败（邮箱已存在）抛出错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: '邮箱已被注册' }),
    }))

    await expect(register('a@b.com', 'test', 'password')).rejects.toThrow('邮箱已被注册')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('注册失败且响应非 JSON 时使用默认消息', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new SyntaxError()),
    }))

    await expect(register('a@b.com', 'test', 'password')).rejects.toThrow('注册失败')
  })
})

describe('login', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useAuthStore.getState().clearAuth()
  })

  it('登录成功后更新 authStore', async () => {
    const mockUser = { id: '1', email: 'a@b.com', username: 'test', role: 'member' as const, avatar: null }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: mockUser, accessToken: 'token-456' }),
    }))

    const user = await login('a@b.com', 'password')
    expect(user).toEqual(mockUser)
    expect(useAuthStore.getState().accessToken).toBe('token-456')
  })

  it('登录失败（密码错误）抛出错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: '邮箱或密码错误' }),
    }))

    await expect(login('a@b.com', 'wrong')).rejects.toThrow('邮箱或密码错误')
  })
})

describe('checkAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useAuthStore.getState().clearAuth()
  })

  it('refresh 成功返回用户', async () => {
    const mockUser = { id: '1', email: 'a@b.com', username: 'test', role: 'admin' as const, avatar: null }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: mockUser, accessToken: 'new-token' }),
    }))

    const user = await checkAuth()
    expect(user).toEqual(mockUser)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('refresh 失败返回 null（cookie 无效）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }))

    const user = await checkAuth()
    expect(user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('网络错误返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const user = await checkAuth()
    expect(user).toBeNull()
  })
})

describe('logout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // 先设置一个已登录状态
    useAuthStore.getState().setAuth(
      { id: '1', email: 'a@b.com', username: 'test', role: 'member', avatar: null },
      'token',
    )
    // 设置一些画布节点
    useCanvasStore.getState().setNodes([
      { id: 'n1', type: 'urlNode', position: { x: 0, y: 0 }, data: { url: 'https://x.com', title: 'X' } },
    ] as any)
    useCanvasStore.getState().setSelectedNodeIds(['n1'])
    useUIStore.getState().setShowLoginModal(false)
  })

  it('登出后清除认证状态', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await logout()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('登出后清空画布节点', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await logout()
    expect(useCanvasStore.getState().nodes).toEqual([])
    expect(useCanvasStore.getState().selectedNodeIds).toEqual([])
    expect(useCanvasStore.getState().focusedGroupId).toBeNull()
  })

  it('登出后弹出登录弹窗', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await logout()
    expect(useUIStore.getState().showLoginModal).toBe(true)
  })

  it('登出请求失败也清除本地状态', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')))

    await logout()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useCanvasStore.getState().nodes).toEqual([])
  })
})
