import { create } from 'zustand'
import { applyNodeChanges } from '@xyflow/react'
import type { OnNodesChange } from '@xyflow/react'
import type { AppNode } from '../types'
import {
  cancelUpload,
  persistNodeDelete,
  persistNodePosition,
  selectionWaterfallLayout,
} from '../utils'

interface CanvasStore {
  // State
  nodes: AppNode[]
  loading: boolean
  initialized: boolean
  selectedNodeIds: string[]
  interactionMode: 'pan' | 'select'

  // Actions
  setNodes: (updater: AppNode[] | ((prev: AppNode[]) => AppNode[])) => void
  setSelectedNodeIds: (ids: string[]) => void
  setLoading: (v: boolean) => void
  setInitialized: (v: boolean) => void
  setInteractionMode: (mode: 'pan' | 'select') => void
  onNodesChange: OnNodesChange<AppNode>
  handleOrganize: () => void
  handleDeleteSelected: () => void
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // ========== State ==========
  nodes: [],
  loading: false,
  initialized: false,
  selectedNodeIds: [],
  interactionMode: 'pan',

  // ========== Actions ==========
  setNodes: (updater) => {
    set((state) => ({
      nodes: typeof updater === 'function' ? updater(state.nodes) : updater,
    }))
  },

  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  setLoading: (v) => set({ loading: v }),
  setInitialized: (v) => set({ initialized: v }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),

  onNodesChange: (changes) => {
    for (const change of changes) {
      if (change.type === 'remove') {
        cancelUpload(change.id)
        persistNodeDelete(change.id)
      }
      // 拖拽结束时持久化位置（dragging 从 true 变 false）
      if (
        change.type === 'position' &&
        change.dragging === false &&
        change.position
      ) {
        persistNodePosition(change.id, change.position.x, change.position.y)
      }
    }
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }))
  },

  handleOrganize: () => {
    const { nodes, selectedNodeIds } = get()
    const selected = nodes.filter((n) => selectedNodeIds.includes(n.id))
    if (selected.length < 1) return

    const positions = selectionWaterfallLayout(selected)

    set((state) => ({
      nodes: state.nodes.map((node) => {
        const newPos = positions.get(node.id)
        if (!newPos) return node
        return { ...node, position: newPos }
      }),
    }))

    for (const [id, pos] of positions.entries()) {
      persistNodePosition(id, pos.x, pos.y)
    }
  },

  handleDeleteSelected: () => {
    const { selectedNodeIds } = get()
    set((state) => ({
      nodes: state.nodes.filter((n) => !selectedNodeIds.includes(n.id)),
      selectedNodeIds: [],
    }))
    for (const id of selectedNodeIds) {
      persistNodeDelete(id)
    }
  },
}))
