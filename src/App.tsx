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
import SettingsModal from './components/SettingsModal'
import SelectionToolbar from './components/SelectionToolbar'
import ModeToolbar from './components/ModeToolbar'
import AIModal from './components/AIModal'
import ErrorToast from './components/ErrorToast'
import LoadingIndicator from './components/LoadingIndicator'
import EmptyHint from './components/EmptyHint'
import { IconProvider } from './icons'

import { useCanvasStore } from './stores/canvasStore'
import { useUIStore } from './stores/uiStore'
import { useCanvasActions } from './hooks/useCanvasActions'
import { useInputListeners } from './hooks/useInputListeners'
import { useDarkModeSync } from './hooks/useDarkModeSync'
import { useNodeLoader } from './hooks/useNodeLoader'
import { useSelectionToolbar } from './hooks/useSelectionToolbar'

import './App.css'

const nodeTypes = {
  urlNode: UrlNode,
  imageNode: MediaNode,
  videoNode: MediaNode,
  docNode: DocNode,
}

function Canvas() {
  useNodeLoader()
  useInputListeners()
  useDarkModeSync()

  const initialized = useCanvasStore((s) => s.initialized)
  const nodes = useCanvasStore((s) => s.nodes)
  const interactionMode = useCanvasStore((s) => s.interactionMode)
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)

  const showSettingsModal = useUIStore((s) => s.showSettingsModal)
  const setShowSettingsModal = useUIStore((s) => s.setShowSettingsModal)
  const darkMode = useUIStore((s) => s.darkMode)

  const actions = useCanvasActions()
  const toolbarPos = useSelectionToolbar()

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
        onNodeDragStop={actions.handleNodeDragStop}
        onMoveEnd={actions.handleMoveEnd}
        onSelectionChange={handleSelectionChange}
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

      <LoadingIndicator />
      <ErrorToast />
      <EmptyHint />

      <AIModal onGenerate={actions.handleAIGenerate} />
      <ModeToolbar />

      {showSettingsModal && (
        <SettingsModal
          darkMode={darkMode}
          onClose={() => setShowSettingsModal(false)}
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
