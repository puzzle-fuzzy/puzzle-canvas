import type { Node } from '@xyflow/react'

// ========== URL 节点 ==========
export type UrlNodeData = {
  url: string
  title: string
  description: string
  image: string | null
  favicon: string | null
  groupId?: string
}

export type UrlNodeType = Node<UrlNodeData, 'urlNode'>

// ========== 图片节点 ==========
export type ImageNodeData = {
  src: string
  fileName: string
  uploading?: UploadState
  groupId?: string
}

export type ImageNodeType = Node<ImageNodeData, 'imageNode'>

// ========== 视频节点 ==========
export type VideoNodeData = {
  src: string
  fileName: string
  uploading?: UploadState
  groupId?: string
}

export type VideoNodeType = Node<VideoNodeData, 'videoNode'>

// ========== 文档节点 ==========
export type DocNodeData = {
  src: string
  fileName: string
  fileSize: number
  uploading?: UploadState
  groupId?: string
}

export type DocNodeType = Node<DocNodeData, 'docNode'>

// ========== 文本节点 ==========
export type TextNodeData = {
  description: string
  groupId?: string
}

export type TextNodeType = Node<TextNodeData, 'textNode'>

// ========== 小组节点 ==========
export type GroupNodeData = {
  label: string
  width: number
  height: number
}

export type GroupNodeType = Node<GroupNodeData, 'groupNode'>

// ========== 联合类型 ==========
export type AppNode = UrlNodeType | ImageNodeType | VideoNodeType | DocNodeType | TextNodeType | GroupNodeType

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
  mediaType: 'image' | 'video' | 'document'
}

// ========== 分片上传 API ==========
export type UploadInitResponse = {
  uploadId: string
  existingChunks: number[]
}
