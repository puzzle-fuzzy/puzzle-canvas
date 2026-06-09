import { useCanvasStore } from '../stores/canvasStore'

function EmptyHint() {
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const loading = useCanvasStore((s) => s.loading)
  const initialized = useCanvasStore((s) => s.initialized)

  if (!initialized || nodeCount > 0 || loading) return null

  return (
    <div className="empty-hint">
      <p>粘贴网址、图片或视频到画布上</p>
      <p className="empty-hint-sub">支持 Ctrl+V / Cmd+V 粘贴，或拖拽文件</p>
    </div>
  )
}

export default EmptyHint
