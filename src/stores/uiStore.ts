import { create } from 'zustand'

interface UIStore {
  // State
  darkMode: boolean
  error: string | null
  showAIModal: boolean
  showSettingsModal: boolean
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
  setAiPrompt: (v: string) => void
  setAiModel: (v: string) => void
  setAiGenerating: (v: boolean) => void
}

function syncDarkModeToDOM(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

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
    set({ error: msg })
    setTimeout(() => set({ error: null }), durationMs)
  },

  setError: (error) => set({ error }),
  setShowAIModal: (v) => set({ showAIModal: v }),
  setShowSettingsModal: (v) => set({ showSettingsModal: v }),
  setAiPrompt: (v) => set({ aiPrompt: v }),
  setAiModel: (v) => set({ aiModel: v }),
  setAiGenerating: (v) => set({ aiGenerating: v }),
}))
