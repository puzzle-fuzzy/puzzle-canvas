import { useCallback, useRef, useEffect, useMemo, memo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import UrlNode from './components/UrlNode'
import MediaNode from './components/MediaNode'
import DocNode from './components/DocNode'
import TextNode from './components/TextNode'
import GroupNode from './components/GroupNode'
import ErrorBoundary from './components/ErrorBoundary'
import SettingsModal from './components/SettingsModal'
import SelectionToolbar from './components/SelectionToolbar'
import ModeToolbar from './components/ModeToolbar'
import AIModal from './components/AIModal'
import LoginModal from './components/LoginModal'
import FullscreenPreview from './components/FullscreenPreview'
import GroupNameModal from './components/GroupNameModal'
import GroupToolbar from './components/GroupToolbar'
import TextPreviewModal from './components/TextPreviewModal'
import ShareModal from './components/ShareModal'
import ImportModal from './components/ImportModal'
import ErrorToast from './components/ErrorToast'
import LoadingIndicator from './components/LoadingIndicator'
import EmptyHint from './components/EmptyHint'
import { IconProvider } from './icons'

import { useCanvasStore } from './stores/canvasStore'
import { useUIStore } from './stores/uiStore'
import { useCanvasActions } from './hooks/useCanvasActions'
import { useInputListeners } from './hooks/useInputListeners'
import { useNodeLoader } from './hooks/useNodeLoader'
import { useSelectionToolbar } from './hooks/useSelectionToolbar'
import { useGroupToolbar } from './hooks/useGroupToolbar'

import './App.css'

// 用 ErrorBoundary 包裹节点组件，隔离单节点渲染崩溃
// memo 包裹确保 ReactFlow 对 props 做浅比较，减少不必要的重渲染
const MemoUrlNode = memo((props: any) => <ErrorBoundary level="node"><UrlNode {...props} /></ErrorBoundary>)
const MemoImageNode = memo((props: any) => <ErrorBoundary level="node"><MediaNode {...props} /></ErrorBoundary>)
const MemoVideoNode = memo((props: any) => <ErrorBoundary level="node"><MediaNode {...props} /></ErrorBoundary>)
const MemoDocNode = memo((props: any) => <ErrorBoundary level="node"><DocNode {...props} /></ErrorBoundary>)
const MemoTextNode = memo((props: any) => <ErrorBoundary level="node"><TextNode {...props} /></ErrorBoundary>)

const nodeTypes = {
  groupNode: GroupNode,
  urlNode: MemoUrlNode,
  imageNode: MemoImageNode,
  videoNode: MemoVideoNode,
  docNode: MemoDocNode,
  textNode: MemoTextNode,
}

function Canvas() {
  useNodeLoader()
  useInputListeners()

  const initialized = useCanvasStore((s) => s.initialized)
  const nodes = useCanvasStore((s) => s.nodes)
  const interactionMode = useCanvasStore((s) => s.interactionMode)
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)

  const showSettingsModal = useUIStore((s) => s.showSettingsModal)
  const setShowSettingsModal = useUIStore((s) => s.setShowSettingsModal)
  const fullscreenPreview = useUIStore((s) => s.fullscreenPreview)
  const setFullscreenPreview = useUIStore((s) => s.setFullscreenPreview)
  const showGroupNameModal = useUIStore((s) => s.showGroupNameModal)
  const groupNameModalMode = useUIStore((s) => s.groupNameModalMode)
  const groupNameModalTarget = useUIStore((s) => s.groupNameModalTarget)
  const closeGroupNameModal = useUIStore((s) => s.closeGroupNameModal)

  // 稳定引用的 onClose 回调，避免子组件因回调引用变化反复注册/注销事件监听器
  const handleSettingsClose = useCallback(() => setShowSettingsModal(false), [setShowSettingsModal])
  const handleFullscreenClose = useCallback(() => setFullscreenPreview(null), [setFullscreenPreview])

  const actions = useCanvasActions()
  const toolbarPos = useSelectionToolbar()
  const groupToolbarPos = useGroupToolbar()

  // 初始视口（渲染前从 localStorage 读取，避免闪烁）
  const savedViewport = useRef(() => {
    try {
      const raw = localStorage.getItem('viewport')
      if (raw) {
        const { x, y, zoom } = JSON.parse(raw)
        return { x, y, zoom }
      }
    } catch { /* ignore */ }
    return { x: 0, y: 0, zoom: 0.5 }
  }).current()

  // 追踪选中的节点（去重：ID 相同时不触发 store 更新）
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: sel }) => {
      const newIds = sel.map((n) => n.id)
      const currentIds = useCanvasStore.getState().selectedNodeIds
      if (newIds.length === currentIds.length && newIds.every((id) => currentIds.includes(id))) {
        return
      }
      useCanvasStore.getState().setSelectedNodeIds(newIds)
    },
    [],
  )

  // 粘贴事件监听
  useEffect(() => {
    window.addEventListener('paste', actions.handlePaste)
    return () => window.removeEventListener('paste', actions.handlePaste)
  }, [actions.handlePaste])

  // 小组命名弹窗提交
  const handleGroupNameSubmit = useCallback(
    (name: string) => {
      const store = useCanvasStore.getState()
      if (groupNameModalMode === 'create') {
        store.handleCreateGroup(name)
      } else if (groupNameModalMode === 'rename' && groupNameModalTarget) {
        store.handleRenameGroup(groupNameModalTarget, name)
      }
      closeGroupNameModal()
    },
    [groupNameModalMode, groupNameModalTarget, closeGroupNameModal],
  )

  // 获取小组重命名的初始值
  const groupRenameInitialValue = useMemo(() => {
    if (groupNameModalMode === 'rename' && groupNameModalTarget) {
      const groupNode = nodes.find((n) => n.id === groupNameModalTarget)
      if (groupNode && groupNode.type === 'groupNode') {
        return (groupNode.data as { label: string }).label
      }
    }
    return ''
  }, [groupNameModalMode, groupNameModalTarget, nodes])

  if (!initialized) {
    return (
      <div className="canvas-loading">
        <span>加载中...</span>
      </div>
    )
  }

  return (
    <div
      className="canvas-container"
      onDragOver={actions.handleDragOver}
      onDrop={actions.handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        onNodeDragStart={actions.handleNodeDragStart}
        onNodeDrag={actions.handleNodeDrag}
        onNodeDragStop={actions.handleNodeDragStop}
        onMoveEnd={actions.handleMoveEnd}
        onSelectionChange={handleSelectionChange}
        onPaneClick={() => useCanvasStore.getState().setFocusedGroupId(null)}
        onNodeClick={(_e, node) => {
          const store = useCanvasStore.getState()
          if (node.type === 'groupNode') {
            // 清除所有节点选中状态 + selectedNodeIds，避免 SelectionToolbar 和小组操作栏同时出现
            store.setNodes((prev) =>
              prev.map((n) => ({ ...n, selected: false })),
            )
            store.setSelectedNodeIds([])
            store.setFocusedGroupId(node.id)
          } else {
            store.setFocusedGroupId(null)
          }
        }}
        nodeTypes={nodeTypes}
        defaultViewport={savedViewport}
        minZoom={0.01}
        maxZoom={4}
        panOnDrag={interactionMode === 'pan'}
        selectionKeyCode={interactionMode === 'select' ? null : 'Space'}
        selectionOnDrag={interactionMode === 'select'}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
      >
        <Background />
        <Controls />
        <MiniMap
          pannable
          zoomable
        />
      </ReactFlow>

      {toolbarPos && (
        <SelectionToolbar
          position={toolbarPos}
          selectedCount={selectedNodeIds.length}
          onDownload={actions.handleDownloadSelected}
        />
      )}

      {groupToolbarPos && (
        <GroupToolbar
          position={{ x: groupToolbarPos.x, y: groupToolbarPos.y, groupId: groupToolbarPos.groupId }}
        />
      )}

      <LoadingIndicator />
      <ErrorToast />
      <EmptyHint />

      <AIModal onGenerate={actions.handleAIGenerate} />
      <TextPreviewModal />
      <ShareModal />
      <ImportModal />
      <LoginModal />
      <ModeToolbar />

      {showSettingsModal && (
        <SettingsModal
          onClose={handleSettingsClose}
        />
      )}

      {showGroupNameModal && (
        <GroupNameModal
          onSubmit={handleGroupNameSubmit}
          onCancel={closeGroupNameModal}
          initialValue={groupRenameInitialValue}
        />
      )}

      {fullscreenPreview && (
        <FullscreenPreview
          src={fullscreenPreview.src}
          fileName={fullscreenPreview.fileName}
          mediaType={fullscreenPreview.mediaType}
          onClose={handleFullscreenClose}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <ReactFlowProvider>
      <IconProvider>
        <Canvas />
      </IconProvider>
    </ReactFlowProvider>
  )
}

export default App
