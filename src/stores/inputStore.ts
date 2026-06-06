import { create } from 'zustand'

interface InputStore {
  spaceHeld: boolean
  mousePosition: { x: number; y: number }
  setSpaceHeld: (v: boolean) => void
  setMousePosition: (pos: { x: number; y: number }) => void
}

export const useInputStore = create<InputStore>((set) => ({
  spaceHeld: false,
  mousePosition: { x: 0, y: 0 },
  setSpaceHeld: (v) => set({ spaceHeld: v }),
  setMousePosition: (pos) => set({ mousePosition: pos }),
}))
