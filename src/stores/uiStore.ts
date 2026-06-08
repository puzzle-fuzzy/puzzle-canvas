import { create } from 'zustand'

function syncDarkModeToDOM(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  } catch {
    // localStorage 可能不可用（隐私模式、配额满）
  }
}

/** 将主题色同步到 CSS 变量和 localStorage */
function syncThemeColorToDOM(color: string, hover: string, rgb: string) {
  const root = document.documentElement.style
  root.setProperty('--color-primary', color)
  root.setProperty('--color-primary-hover', hover)
  root.setProperty('--color-primary-rgb', rgb)
  try {
    localStorage.setItem('themeColor', color)
  } catch { /* */ }
}

/** 将 icon 大小同步到 CSS 变量和 localStorage */
function syncToolbarIconSizeToDOM(size: number) {
  document.documentElement.style.setProperty('--toolbar-icon-size', `${size}px`)
  try {
    localStorage.setItem('toolbarIconSize', String(size))
  } catch { /* */ }
}

/** 从 hex 色值计算 hover 色（简单提亮） */
function hexToHover(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lighten = (v: number) => Math.min(255, v + Math.round((255 - v) * 0.3))
  return `#${[lighten(r), lighten(g), lighten(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** 从 hex 色值提取 RGB 字符串 */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

export type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right'

interface UIStore {
  // State
  darkMode: boolean
  error: string | null
  showAIModal: boolean
  showSettingsModal: boolean
  showLoginModal: boolean
  settingsSection: string
  fullscreenPreview: { src: string; fileName: string; mediaType: 'image' | 'video' } | null
  themeColor: string
  toolbarIconSize: number
  toolbarPosition: ToolbarPosition
  aiPrompt: string
  aiModel: string
  aiGenerating: boolean
  showGroupNameModal: boolean
  groupNameModalMode: 'create' | 'rename'
  groupNameModalTarget: string | null
  textPreview: string | null
  showShareModal: boolean
  showImportModal: boolean

  // Actions
  toggleDarkMode: () => void
  setDarkMode: (v: boolean) => void
  showError: (msg: string, durationMs?: number) => void
  setError: (error: string | null) => void
  setShowAIModal: (v: boolean) => void
  setShowSettingsModal: (v: boolean) => void
  setShowLoginModal: (v: boolean) => void
  setSettingsSection: (v: string) => void
  setFullscreenPreview: (v: { src: string; fileName: string; mediaType: 'image' | 'video' } | null) => void
  setThemeColor: (v: string) => void
  setToolbarIconSize: (v: number) => void
  setToolbarPosition: (v: ToolbarPosition) => void
  setAiPrompt: (v: string) => void
  setAiModel: (v: string) => void
  setAiGenerating: (v: boolean) => void
  openGroupNameModal: (mode: 'create' | 'rename', target?: string) => void
  closeGroupNameModal: () => void
  setTextPreview: (v: string | null) => void
  setShowShareModal: (v: boolean) => void
  setShowImportModal: (v: boolean) => void
}

let errorTimer: ReturnType<typeof setTimeout> | null = null

/** 初始化主题色到 DOM（页面加载时调用） */
function initThemeColor(color: string) {
  syncThemeColorToDOM(color, hexToHover(color), hexToRgb(color))
}

/** 初始化 icon 大小到 DOM */
function initToolbarIconSize(size: number) {
  syncToolbarIconSizeToDOM(size)
}

const defaultThemeColor = '#6366f1'
const defaultToolbarIconSize = 20
const defaultToolbarPosition: ToolbarPosition = 'right'

export const useUIStore = create<UIStore>((set) => {
  // 从 localStorage 恢复外观设置并同步到 DOM
  const savedColor = (() => {
    try { return localStorage.getItem('themeColor') } catch { return null }
  })() ?? defaultThemeColor

  const savedIconSize = (() => {
    try {
      const v = localStorage.getItem('toolbarIconSize')
      return v ? parseInt(v, 10) : defaultToolbarIconSize
    } catch { return defaultToolbarIconSize }
  })()

  const savedToolbarPosition = (() => {
    try {
      const v = localStorage.getItem('toolbarPosition')
      if (v && ['top', 'bottom', 'left', 'right'].includes(v)) return v as ToolbarPosition
      return defaultToolbarPosition
    } catch { return defaultToolbarPosition }
  })()

  // 初始化 CSS 变量
  initThemeColor(savedColor)
  initToolbarIconSize(savedIconSize)

  return {
    // ========== State ==========
    darkMode: (() => {
      const saved = localStorage.getItem('theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    })(),
    error: null,
    showAIModal: false,
    showSettingsModal: false,
    showLoginModal: false,
    settingsSection: 'icons',
    fullscreenPreview: null,
    themeColor: savedColor,
    toolbarIconSize: savedIconSize,
    toolbarPosition: savedToolbarPosition,
    aiPrompt: '',
    aiModel: 'dall-e-3',
    aiGenerating: false,
    showGroupNameModal: false,
    groupNameModalMode: 'create',
    groupNameModalTarget: null,
    textPreview: null,
    showShareModal: false,
    showImportModal: false,

    // ========== Actions ==========
    toggleDarkMode: () => {
      set((state) => {
        const next = !state.darkMode
        syncDarkModeToDOM(next)
        return { darkMode: next }
      })
    },

    setDarkMode: (v) => {
      syncDarkModeToDOM(v)
      set({ darkMode: v })
    },

    showError: (msg, durationMs = 3000) => {
      if (errorTimer) clearTimeout(errorTimer)
      set({ error: msg })
      errorTimer = setTimeout(() => {
        set({ error: null })
        errorTimer = null
      }, durationMs)
    },

    setError: (error) => set({ error }),
    setShowAIModal: (v) => set({ showAIModal: v }),
    setShowSettingsModal: (v) => set({ showSettingsModal: v }),
    setShowLoginModal: (v) => set({ showLoginModal: v }),
    setSettingsSection: (v) => set({ settingsSection: v }),
    setFullscreenPreview: (v) => set({ fullscreenPreview: v }),

    setThemeColor: (v) => {
      syncThemeColorToDOM(v, hexToHover(v), hexToRgb(v))
      set({ themeColor: v })
    },

    setToolbarIconSize: (v) => {
      syncToolbarIconSizeToDOM(v)
      set({ toolbarIconSize: v })
    },
    setToolbarPosition: (v) => {
      try { localStorage.setItem('toolbarPosition', v) } catch { /* */ }
      set({ toolbarPosition: v })
    },

    setAiPrompt: (v) => set({ aiPrompt: v }),
    setAiModel: (v) => set({ aiModel: v }),
    setAiGenerating: (v) => set({ aiGenerating: v }),

    openGroupNameModal: (mode, target) => set({
      showGroupNameModal: true,
      groupNameModalMode: mode,
      groupNameModalTarget: target,
    }),
    closeGroupNameModal: () => set({
      showGroupNameModal: false,
      groupNameModalMode: 'create',
      groupNameModalTarget: null,
    }),
    setTextPreview: (v) => set({ textPreview: v }),
    setShowShareModal: (v) => set({ showShareModal: v }),
    setShowImportModal: (v) => set({ showImportModal: v }),
  }
})
