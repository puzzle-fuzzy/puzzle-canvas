import type { Node } from '@xyflow/react'

// ========== URL 节点 ==========
export type UrlNodeData = {
  url: string
  title: string
  description: string
  image: string | null
  favicon: string | null
}

export type UrlNodeType = Node<UrlNodeData, 'urlNode'>

// ========== 图片节点 ==========
export type ImageNodeData = {
  src: string
  fileName: string
}

export type ImageNodeType = Node<ImageNodeData, 'imageNode'>

// ========== 视频节点 ==========
export type VideoNodeData = {
  src: string
  fileName: string
}

export type VideoNodeType = Node<VideoNodeData, 'videoNode'>

// ========== 联合类型 ==========
export type AppNode = UrlNodeType | ImageNodeType | VideoNodeType

// ========== API 响应 ==========
export type MetadataResponse = {
  url: string
  title: string
  description: string
  image: string | null
  favicon: string | null
}

export type UploadResponse = {
  src: string
  fileName: string
  mediaType: 'image' | 'video'
}
