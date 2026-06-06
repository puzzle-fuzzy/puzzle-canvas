import { useEffect } from 'react'
import { useCanvasStore } from '../stores/canvasStore'
import { loadNodes } from '../utils'

/**
 * 初始加载节点 — 挂载时从后端加载所有节点写入 store
 */
export function useNodeLoader() {
  useEffect(() => {
    const { setNodes, setInitialized } = useCanvasStore.getState()

    loadNodes()
      .then((loaded) => {
        setNodes(loaded)
        setInitialized(true)
      })
      .catch((err) => {
        console.error('Failed to load nodes:', err)
        setInitialized(true)
      })
  }, [])
}
