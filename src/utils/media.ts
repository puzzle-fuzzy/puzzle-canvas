import { NODE_WIDTH } from './constants'

const MEDIA_DIMENSION_TIMEOUT = 10_000 // 10 秒

/** 带超时的 Promise 包装，防止 onload/onerror 永远不触发 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

/** 从本地 File 预计算图片渲染高度 */
export function getImageFileHeight(file: File): Promise<number> {
  return withTimeout(
    new Promise<number>((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        const ratio = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1
        resolve(Math.round(NODE_WIDTH * ratio))
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(NODE_WIDTH)
      }
      img.src = url
    }),
    MEDIA_DIMENSION_TIMEOUT,
    NODE_WIDTH,
  )
}

/** 从本地 File 预计算视频渲染高度 */
export function getVideoFileHeight(file: File): Promise<number> {
  return withTimeout(
    new Promise<number>((resolve) => {
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
    }),
    MEDIA_DIMENSION_TIMEOUT,
    NODE_WIDTH,
  )
}
