import { useEffect } from 'react'
import { useInputStore } from '../stores/inputStore'
import { useUIStore } from '../stores/uiStore'

/**
 * 注册全局鼠标和键盘事件监听
 * - mousemove → 更新 mousePosition（rAF 节流，避免每像素触发 store 更新）
 * - Space keydown/keyup → 更新 spaceHeld
 * - blur → 重置 spaceHeld（防止 Alt+Tab 等场景下 keyup 丢失导致卡住）
 * - 系统 prefers-color-scheme 变化 → 更新 darkMode（仅当用户未手动设置时）
 */
export function useInputListeners() {
  useEffect(() => {
    let rafId: number | null = null
    let lastX = 0
    let lastY = 0

    const onMouseMove = (e: MouseEvent) => {
      lastX = e.clientX
      lastY = e.clientY
      // 用 rAF 节流：每帧最多更新一次，避免高频 mousemove 淹没渲染
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          useInputStore.getState().setMousePosition({ x: lastX, y: lastY })
          rafId = null
        })
      }
    }
    const onSpaceDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return
        }
        useInputStore.getState().setSpaceHeld(true)
      }
    }
    const onSpaceUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return
        }
        useInputStore.getState().setSpaceHeld(false)
      }
    }
    // 窗口失焦时重置 spaceHeld，防止 Alt+Tab 等场景 keyup 丢失
    const onBlur = () => {
      useInputStore.getState().setSpaceHeld(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onSpaceDown)
    window.addEventListener('keyup', onSpaceUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onSpaceDown)
      window.removeEventListener('keyup', onSpaceUp)
      window.removeEventListener('blur', onBlur)
      if (rafId !== null) cancelAnimationFrame(rafId)
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
