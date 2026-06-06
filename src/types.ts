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
  uploading?: UploadState
}

export type ImageNodeType = Node<ImageNodeData, 'imageNode'>

// ========== 视频节点 ==========
export type VideoNodeData = {
  src: string
  fileName: string
  uploading?: UploadState
}

export type VideoNodeType = Node<VideoNodeData, 'videoNode'>

// ========== 联合类型 ==========
export type AppNode = UrlNodeType | ImageNodeType | VideoNodeType

// ========== 上传状态 ==========
export type UploadState = {
  progress: number // 0..1
  fileName: string
}

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

// ========== 分片上传 API ==========
export type UploadInitResponse = {
  uploadId: string
  existingChunks: number[]
}
