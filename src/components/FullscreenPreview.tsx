import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface FullscreenPreviewProps {
  src: string
  fileName: string
  mediaType: 'image' | 'video'
  onClose: () => void
}

/**
 * 全屏预览组件
 *
 * 通过 createPortal 挂载到 document.body，脱离 React Flow 的 z-index 上下文。
 * 点击遮罩或按 Escape 关闭。
 */
function FullscreenPreview({ src, fileName, mediaType, onClose }: FullscreenPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Escape 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // 视频自动播放
  useEffect(() => {
    if (mediaType === 'video') {
      videoRef.current?.play().catch(() => {})
    }
  }, [mediaType])

  return createPortal(
    <div className="fullscreen-preview-overlay" onClick={onClose}>
      <div className="fullscreen-preview-content" onClick={(e) => e.stopPropagation()}>
        {mediaType === 'image' ? (
          <img src={src} alt={fileName} />
        ) : (
          <video
            ref={videoRef}
            src={src}
            controls
            autoPlay
            loop
          />
        )}
      </div>
    </div>,
    document.body,
  )
}

export default FullscreenPreview
