import type { NodeProps } from '@xyflow/react'
import type { ImageNodeType, VideoNodeType } from '../types'

type MediaNodeProps = NodeProps<ImageNodeType> | NodeProps<VideoNodeType>

function MediaNode({ data, type }: MediaNodeProps) {
  const isVideo = type === 'videoNode'

  return (
    <div className="media-node">
      {isVideo ? (
        <div className="media-video-wrapper">
          <video
            className="media-video"
            src={data.src}
            controls
            preload="metadata"
          />
        </div>
      ) : (
        <div className="media-image-wrapper">
          <img className="media-image" src={data.src} alt={data.fileName} />
        </div>
      )}
      <div className="media-node-body">
        <p className="media-file-name">{data.fileName}</p>
      </div>
    </div>
  )
}

export default MediaNode
