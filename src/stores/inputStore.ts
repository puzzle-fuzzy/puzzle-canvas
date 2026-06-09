import { create } from 'zustand'

interface InputStore {
  spaceHeld: boolean
  mouseX: number
  mouseY: number
  setSpaceHeld: (v: boolean) => void
  setMousePosition: (pos: { x: number; y: number }) => void
}

export const useInputStore = create<InputStore>((set) => ({
  spaceHeld: false,
  mouseX: 0,
  mouseY: 0,
  setSpaceHeld: (v) => set({ spaceHeld: v }),
  setMousePosition: (pos) => set({ mouseX: pos.x, mouseY: pos.y }),
}))
