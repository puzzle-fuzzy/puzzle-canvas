import { create } from 'zustand'

function syncDarkModeToDOM(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  } catch {
    // localStorage 可能不可用（隐私模式、配额满）
  }
}

interface UIStore {
  // State
  darkMode: boolean
  error: string | null
  showAIModal: boolean
  showSettingsModal: boolean
  showLoginModal: boolean
  settingsSection: string
  fullscreenPreview: { src: string; fileName: string; mediaType: 'image' | 'video' } | null
  aiPrompt: string
  aiModel: string
  aiGenerating: boolean

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
  setAiPrompt: (v: string) => void
  setAiModel: (v: string) => void
  setAiGenerating: (v: boolean) => void
}

let errorTimer: ReturnType<typeof setTimeout> | null = null

export const useUIStore = create<UIStore>((set) => ({
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
  aiPrompt: '',
  aiModel: 'dall-e-3',
  aiGenerating: false,

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
  setAiPrompt: (v) => set({ aiPrompt: v }),
  setAiModel: (v) => set({ aiModel: v }),
  setAiGenerating: (v) => set({ aiGenerating: v }),
}))
