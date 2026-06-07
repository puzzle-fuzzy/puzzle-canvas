import { useCallback, useRef, useEffect } from 'react'
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
const nodeTypes = {
  groupNode: GroupNode,
  urlNode: (() => { const W = (props: any) => <ErrorBoundary level="node"><UrlNode {...props} /></ErrorBoundary>; W.displayName = 'UrlNode'; return W })(),
  imageNode: (() => { const W = (props: any) => <ErrorBoundary level="node"><MediaNode {...props} /></ErrorBoundary>; W.displayName = 'ImageNode'; return W })(),
  videoNode: (() => { const W = (props: any) => <ErrorBoundary level="node"><MediaNode {...props} /></ErrorBoundary>; W.displayName = 'VideoNode'; return W })(),
  docNode: (() => { const W = (props: any) => <ErrorBoundary level="node"><DocNode {...props} /></ErrorBoundary>; W.displayName = 'DocNode'; return W })(),
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

  // 追踪选中的节点
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: sel }) => {
      useCanvasStore.getState().setSelectedNodeIds(sel.map((n) => n.id))
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
  const groupRenameInitialValue = (() => {
    if (groupNameModalMode === 'rename' && groupNameModalTarget) {
      const groupNode = nodes.find((n) => n.id === groupNameModalTarget)
      if (groupNode && groupNode.type === 'groupNode') {
        return (groupNode.data as { label: string }).label
      }
    }
    return ''
  })()

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
            // 清除所有节点选中状态，避免 SelectionToolbar 和小组操作栏同时出现
            store.setNodes((prev) =>
              prev.map((n) => ({ ...n, selected: false })),
            )
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
      <LoginModal />
      <ModeToolbar />

      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
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
          onClose={() => setFullscreenPreview(null)}
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
