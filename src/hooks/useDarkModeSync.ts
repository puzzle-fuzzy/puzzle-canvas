import { useEffect } from 'react'
import { useUIStore } from '../stores/uiStore'

/**
 * 同步 darkMode 状态到 DOM 和 localStorage
 * 替代原来的 useEffect darkMode 同步
 */
export function useDarkModeSync() {
  useEffect(() => {
    // 初始同步
    const { darkMode } = useUIStore.getState()
    document.documentElement.classList.toggle('dark', darkMode)

    // 订阅后续变化
    const unsub = useUIStore.subscribe((state, prevState) => {
      if (state.darkMode !== prevState.darkMode) {
        document.documentElement.classList.toggle('dark', state.darkMode)
        localStorage.setItem('theme', state.darkMode ? 'dark' : 'light')
      }
    })
    return unsub
  }, [])
}
