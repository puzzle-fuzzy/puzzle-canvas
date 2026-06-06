import { NODE_WIDTH } from './constants'

/** 从本地 File 预计算图片渲染高度 */
export function getImageFileHeight(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const ratio = img.naturalHeight / img.naturalWidth
      resolve(Math.round(NODE_WIDTH * ratio))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(NODE_WIDTH)
    }
    img.src = url
  })
}

/** 从本地 File 预计算视频渲染高度 */
export function getVideoFileHeight(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const ratio = video.videoHeight / video.videoWidth
      resolve(Math.round(NODE_WIDTH * (ratio || 1)))
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(NODE_WIDTH)
    }
    video.src = url
  })
}
