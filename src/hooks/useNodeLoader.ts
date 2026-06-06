import { useEffect } from 'react'
import { useCanvasStore } from '../stores/canvasStore'
import { useUIStore } from '../stores/uiStore'
import { useAuthStore } from '../stores/authStore'
import { loadNodes } from '../utils/api'
import { checkAuth } from '../utils/auth'

/**
 * 初始加载流程
 *
 * mount → checkAuth()（用 httpOnly cookie 恢复会话）
 *   ├─ 已登录 → loadNodes() → setInitialized(true)
 *   └─ 未登录 → setShowLoginModal(true) → setInitialized(true)（显示空画布）
 */
export function useNodeLoader() {
  useEffect(() => {
    const { setNodes, setInitialized } = useCanvasStore.getState()
    const { setShowLoginModal } = useUIStore.getState()
    const { setLoading } = useAuthStore.getState()

    async function init() {
      // 1. 尝试用 refresh cookie 恢复会话
      const user = await checkAuth()

      if (!user) {
        // 未登录：显示登录弹窗，画布显示为空
        setShowLoginModal(true)
        setInitialized(true)
        setLoading(false)
        return
      }

      // 2. 已登录：加载用户的节点
      try {
        const loaded = await loadNodes()
        setNodes(loaded)
      } catch (err) {
        console.error('Failed to load nodes:', err)
        useUIStore.getState().showError('节点加载失败，请刷新页面重试')
      }

      setInitialized(true)
      setLoading(false)
    }

    init()
  }, [])

  // 页面可见性变化时自动刷新 token
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState === 'visible' && useAuthStore.getState().isAuthenticated) {
        await checkAuth()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])
}
