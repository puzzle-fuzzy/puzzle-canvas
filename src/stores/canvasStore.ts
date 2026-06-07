import { create } from 'zustand'
import { applyNodeChanges } from '@xyflow/react'
import type { OnNodesChange, NodeChange } from '@xyflow/react'
import type { AppNode, GroupNodeType } from '../types'
import {
  cancelUpload,
  persistNodeDelete,
  persistNodePosition,
  persistNode,
  persistNodeGroupId,
  persistGroupUpdate,
  selectionWaterfallLayout,
  computeGroupBounds,
} from '../utils'

/** 获取节点的 groupId（安全访问任意节点 data） */
function getNodeGroupId(node: AppNode): string | undefined {
  if (node.type === 'groupNode') return undefined
  return (node.data as Record<string, unknown>).groupId as string | undefined
}

/** 设置节点的 groupId（返回新节点对象） */
function setNodeGroupId<T extends AppNode>(node: T, groupId: string | undefined): T {
  if (node.type === 'groupNode') return node
  return { ...node, data: { ...node.data, groupId } } as T
}

interface CanvasStore {
  // State
  nodes: AppNode[]
  loading: boolean
  initialized: boolean
  selectedNodeIds: string[]
  interactionMode: 'pan' | 'select'
  focusedGroupId: string | null

  // Actions
  setNodes: (updater: AppNode[] | ((prev: AppNode[]) => AppNode[])) => void
  setSelectedNodeIds: (ids: string[]) => void
  setLoading: (v: boolean) => void
  setInitialized: (v: boolean) => void
  setInteractionMode: (mode: 'pan' | 'select') => void
  setFocusedGroupId: (id: string | null) => void
  onNodesChange: OnNodesChange<AppNode>
  handleOrganize: () => void
  handleDeleteSelected: () => void
  handleCreateGroup: (label: string) => void
  handleUngroup: (groupId: string) => void
  handleRenameGroup: (groupId: string, newLabel: string) => void
  handleOrganizeGroup: (groupId: string) => void
}

/** 检查变更是否为 NodeRemoveChange */
function isRemoveChange(c: NodeChange<AppNode>): c is NodeChange<AppNode> & { type: 'remove'; id: string } {
  return c.type === 'remove' && 'id' in c
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // ========== State ==========
  nodes: [],
  loading: false,
  initialized: false,
  selectedNodeIds: [],
  interactionMode: 'pan',
  focusedGroupId: null,

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
  setFocusedGroupId: (id) => set({ focusedGroupId: id }),

  onNodesChange: (changes) => {
    const state = get()

    // 忽略 groupNode 的选中变更（groupNode 不可选中）
    const filtered = changes.filter((c) => {
      if (c.type === 'select') {
        const node = state.nodes.find((n) => n.id === c.id)
        return node?.type !== 'groupNode'
      }
      return true
    })

    if (filtered.length === 0) return

    // 检测 groupNode 的 remove 变更，执行 ungroup 逻辑
    const groupRemovalIds = new Set<string>()
    for (const c of filtered) {
      if (isRemoveChange(c)) {
        const node = state.nodes.find((n) => n.id === c.id)
        if (node?.type === 'groupNode') {
          groupRemovalIds.add(c.id)
        }
      }
    }

    if (groupRemovalIds.size > 0) {
      for (const groupId of groupRemovalIds) {
        const memberIds = new Set(
          state.nodes
            .filter((n) => n.type !== 'groupNode' && getNodeGroupId(n) === groupId)
            .map((n) => n.id),
        )

        set((s) => ({
          nodes: s.nodes
            .filter((n) => n.id !== groupId)
            .map((n) =>
              memberIds.has(n.id) ? setNodeGroupId(n, undefined) : n,
            ) as AppNode[],
        }))

        for (const mid of memberIds) {
          persistNodeGroupId(mid, null)
        }
        persistNodeDelete(groupId)
      }

      // 处理剩余的非 groupNode remove 变更
      const remainingChanges = filtered.filter((c) =>
        !(isRemoveChange(c) && groupRemovalIds.has(c.id))
      )
      if (remainingChanges.length > 0) {
        for (const change of remainingChanges) {
          if (change.type === 'remove') {
            cancelUpload(change.id)
            persistNodeDelete(change.id)
          }
          if (change.type === 'position' && change.dragging === false && change.position) {
            persistNodePosition(change.id, change.position.x, change.position.y)
          }
        }
        set((s) => ({ nodes: applyNodeChanges(remainingChanges, s.nodes) }))
      }
      return
    }

    // 默认处理逻辑
    for (const change of filtered) {
      if (change.type === 'remove') {
        cancelUpload(change.id)
        persistNodeDelete(change.id)
      }
      if (
        change.type === 'position' &&
        change.dragging === false &&
        change.position
      ) {
        persistNodePosition(change.id, change.position.x, change.position.y)
      }
    }
    set((state) => ({
      nodes: applyNodeChanges(filtered, state.nodes),
    }))
  },

  handleOrganize: () => {
    const { nodes, selectedNodeIds } = get()
    const selected = nodes.filter((n) => selectedNodeIds.includes(n.id))
    if (selected.length < 2) return

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
    const { nodes, selectedNodeIds } = get()

    // 分离 groupNode 和普通节点
    const groupIds = new Set(
      selectedNodeIds.filter(
        (id) => nodes.find((n) => n.id === id)?.type === 'groupNode',
      ),
    )
    const otherIds = selectedNodeIds.filter((id) => !groupIds.has(id))

    // 删除普通节点
    if (otherIds.length > 0) {
      set((state) => ({
        nodes: state.nodes.filter((n) => !otherIds.includes(n.id)),
      }))
      for (const id of otherIds) {
        cancelUpload(id)
        persistNodeDelete(id)
      }
    }

    // 对 groupNode 执行 ungroup
    for (const groupId of groupIds) {
      const memberIds = new Set(
        nodes
          .filter((n) => n.type !== 'groupNode' && getNodeGroupId(n) === groupId)
          .map((n) => n.id),
      )
      set((s) => ({
        nodes: s.nodes
          .filter((n) => n.id !== groupId)
          .map((n) =>
            memberIds.has(n.id) ? setNodeGroupId(n, undefined) : n,
          ) as AppNode[],
      }))
      for (const mid of memberIds) {
        persistNodeGroupId(mid, null)
      }
      persistNodeDelete(groupId)
    }

    set({ selectedNodeIds: [] })
  },

  // ========== 小组操作 ==========

  handleCreateGroup: (label: string) => {
    const { nodes, selectedNodeIds } = get()

    // 只取非 groupNode 且没有 groupId 的选中节点
    const members = nodes.filter(
      (n) =>
        selectedNodeIds.includes(n.id) &&
        n.type !== 'groupNode' &&
        !getNodeGroupId(n),
    )
    if (members.length < 2) return

    const bounds = computeGroupBounds(members)
    if (!bounds) return

    const groupId = crypto.randomUUID()
    const groupNode: GroupNodeType = {
      id: groupId,
      type: 'groupNode',
      position: { x: bounds.x, y: bounds.y },
      data: { label, width: bounds.width, height: bounds.height },
      selectable: false,
    }

    const memberIds = new Set(members.map((m) => m.id))

    // 更新 store：小组节点插到最前面（渲染层级低），成员节点设置 groupId
    // 同时清除所有节点的 selected 状态，避免 ReactFlow 选区残留
    set((state) => ({
      nodes: [
        groupNode,
        ...state.nodes.map((n) => ({
          ...(memberIds.has(n.id) ? setNodeGroupId(n, groupId) : n),
          selected: false,
        })),
      ] as AppNode[],
      selectedNodeIds: [],
    }))

    // 持久化
    persistNode(groupNode)
    for (const mid of memberIds) {
      persistNodeGroupId(mid, groupId)
    }
  },

  handleUngroup: (groupId: string) => {
    const { nodes } = get()
    const memberIds = new Set(
      nodes
        .filter((n) => n.type !== 'groupNode' && getNodeGroupId(n) === groupId)
        .map((n) => n.id),
    )

    set((state) => ({
      nodes: state.nodes
        .filter((n) => n.id !== groupId)
        .map((n) =>
          memberIds.has(n.id) ? setNodeGroupId(n, undefined) : n,
        ) as AppNode[],
      selectedNodeIds: [],
    }))

    persistNodeDelete(groupId)
    for (const mid of memberIds) {
      persistNodeGroupId(mid, null)
    }
  },

  handleRenameGroup: (groupId: string, newLabel: string) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === groupId && n.type === 'groupNode'
          ? { ...n, data: { ...n.data, label: newLabel } }
          : n,
      ),
    }))

    persistGroupUpdate(groupId, { label: newLabel })
  },

  handleOrganizeGroup: (groupId: string) => {
    const { nodes } = get()
    const members = nodes.filter(
      (n) => n.type !== 'groupNode' && getNodeGroupId(n) === groupId,
    )
    if (members.length < 2) return

    const positions = selectionWaterfallLayout(members)
    const updated = new Map(positions)

    // 用新位置重建成员列表来计算新边界
    const movedMembers = members.map((n) => {
      const pos = updated.get(n.id)
      return pos ? { ...n, position: pos } : n
    })

    const newBounds = computeGroupBounds(movedMembers)
    if (!newBounds) return

    // 更新成员位置 + 小组边界
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id === groupId && n.type === 'groupNode') {
          return {
            ...n,
            position: { x: newBounds.x, y: newBounds.y },
            data: { ...n.data, width: newBounds.width, height: newBounds.height },
          }
        }
        const pos = updated.get(n.id)
        if (pos) return { ...n, position: pos }
        return n
      }),
    }))

    // 持久化
    for (const [id, pos] of updated.entries()) {
      persistNodePosition(id, pos.x, pos.y)
    }
    persistGroupUpdate(groupId, { width: newBounds.width, height: newBounds.height })
    persistNodePosition(groupId, newBounds.x, newBounds.y)
  },
}))
