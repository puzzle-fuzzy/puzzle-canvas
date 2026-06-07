import { NODE_WIDTH } from './constants'

const MEDIA_DIMENSION_TIMEOUT = 10_000 // 10 秒

/** 从本地 File 预计算图片渲染高度 */
export function getImageFileHeight(file: File): Promise<number> {
  return new Promise<number>((resolve) => {
    let settled = false
    const url = URL.createObjectURL(file)
    const img = new Image()

    const cleanup = () => {
      if (!settled) return
      URL.revokeObjectURL(url)
    }

    img.onload = () => {
      if (settled) return
      settled = true
      const ratio = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1
      resolve(Math.round(NODE_WIDTH * ratio))
      cleanup()
    }
    img.onerror = () => {
      if (settled) return
      settled = true
      resolve(NODE_WIDTH)
      cleanup()
    }
    img.src = url

    // 超时保护：revoke URL 并中止加载
    setTimeout(() => {
      if (settled) return
      settled = true
      img.src = '' // 中止加载
      URL.revokeObjectURL(url)
      resolve(NODE_WIDTH)
    }, MEDIA_DIMENSION_TIMEOUT)
  })
}

/** 从本地 File 预计算视频渲染高度 */
export function getVideoFileHeight(file: File): Promise<number> {
  return new Promise<number>((resolve) => {
    let settled = false
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'

    const cleanup = () => {
      if (!settled) return
      URL.revokeObjectURL(url)
    }

    video.onloadedmetadata = () => {
      if (settled) return
      settled = true
      const ratio = video.videoWidth ? video.videoHeight / video.videoWidth : 1
      resolve(Math.round(NODE_WIDTH * ratio))
      cleanup()
    }
    video.onerror = () => {
      if (settled) return
      settled = true
      resolve(NODE_WIDTH)
      cleanup()
    }
    video.src = url

    // 超时保护：revoke URL
    setTimeout(() => {
      if (settled) return
      settled = true
      video.src = '' // 中止加载
      URL.revokeObjectURL(url)
      resolve(NODE_WIDTH)
    }, MEDIA_DIMENSION_TIMEOUT)
  })
}
