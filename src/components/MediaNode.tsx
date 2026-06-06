import { useRef, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import type { ImageNodeType, VideoNodeType } from '../types'

type MediaNodeProps = NodeProps<ImageNodeType> | NodeProps<VideoNodeType>

function MediaNode({ data, type }: MediaNodeProps) {
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
