import { useRef, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import type { ImageNodeType, VideoNodeType } from '../types'
import { cancelUpload } from '../utils'

type MediaNodeProps = NodeProps<ImageNodeType> | NodeProps<VideoNodeType>

function MediaNode({ data, type, id }: MediaNodeProps) {
  const isVideo = type === 'videoNode'
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleMouseEnter = useCallback(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  const handleMouseLeave = useCallback(() => {
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = 0
    }
  }, [])

  const handleCancel = useCallback(() => {
    cancelUpload(id)
  }, [id])

  // 上传中 → 显示进度
  if (data.uploading) {
    const percent = Math.round(data.uploading.progress * 100)

    return (
      <div className="media-node media-node--uploading">
        <div className="upload-progress-content">
          <span className="upload-progress-icon">{isVideo ? '🎬' : '🖼️'}</span>
          <span className="upload-progress-filename">{data.uploading.fileName}</span>
          <div className="upload-progress-bar-track">
            <div
              className="upload-progress-bar-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="upload-progress-percent">{percent}%</span>
        </div>
        <button
          className="upload-cancel-btn"
          onClick={handleCancel}
          title="取消上传"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  // 正常渲染
  return (
    <div className="media-node">
      {isVideo ? (
        <div
          className="media-video-wrapper"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <video
            ref={videoRef}
            className="media-video"
            src={data.src}
            preload="metadata"
            muted
            loop
            playsInline
          />
        </div>
      ) : (
        <div className="media-image-wrapper">
          <img className="media-image" src={data.src} alt={data.fileName} />
        </div>
      )}
      <span className="media-file-name">{data.fileName}</span>
    </div>
  )
}

export default MediaNode
