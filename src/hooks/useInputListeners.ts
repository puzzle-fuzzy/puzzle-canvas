import { useEffect } from 'react'
import { useInputStore } from '../stores/inputStore'
import { useUIStore } from '../stores/uiStore'

/**
 * 注册全局鼠标和键盘事件监听
 * - mousemove → 更新 mousePosition
 * - Space keydown/keyup → 更新 spaceHeld
 * - 系统 prefers-color-scheme 变化 → 更新 darkMode（仅当用户未手动设置时）
 */
export function useInputListeners() {
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      useInputStore.getState().setMousePosition({ x: e.clientX, y: e.clientY })
    }
    const onSpaceDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        useInputStore.getState().setSpaceHeld(true)
      }
    }
    const onSpaceUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        useInputStore.getState().setSpaceHeld(false)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onSpaceDown)
    window.addEventListener('keyup', onSpaceUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onSpaceDown)
      window.removeEventListener('keyup', onSpaceUp)
    }
  }, [])

  // 监听系统主题变化（仅在用户未手动设置过时跟随）
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        useUIStore.getState().setDarkMode(e.matches)
      }
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
}
