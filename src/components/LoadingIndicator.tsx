import { useCanvasStore } from '../stores/canvasStore'

function LoadingIndicator() {
  const loading = useCanvasStore((s) => s.loading)

  if (!loading) return null

  return <div className="loading-indicator">处理中...</div>
}

export default LoadingIndicator
