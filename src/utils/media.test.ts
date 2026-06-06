import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NODE_WIDTH } from './constants'
import { getImageFileHeight } from './media'

/** 创建可控的 mock Image 对象 */
function createMockImage(naturalWidth: number, naturalHeight: number) {
  let _onload: (() => void) | null = null
  let _onerror: (() => void) | null = null
  const img = {
    get onload() { return _onload },
    set onload(fn: (() => void) | null) { _onload = fn },
    get onerror() { return _onerror },
    set onerror(fn: (() => void) | null) { _onerror = fn },
    naturalWidth,
    naturalHeight,
    src: '',
  }
  return {
    img,
    triggerOnload: () => _onload?.(),
    triggerOnerror: () => _onerror?.(),
  }
}

describe('getImageFileHeight', () => {
  let mockRef: ReturnType<typeof createMockImage>

  beforeEach(() => {
    // jsdom 提供 Image 构造函数，我们用 spyOn 替代它
  })

  it('正常图片计算正确高度', async () => {
    const { img, triggerOnload } = createMockImage(640, 480)
    const OriginalImage = globalThis.Image

    // @ts-expect-error 替换全局 Image 构造函数
    globalThis.Image = function () {
      queueMicrotask(() => triggerOnload())
      return img
    }

    try {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      const height = await getImageFileHeight(file)
      // 640x480 → ratio=0.75 → 320*0.75 = 240
      expect(height).toBe(240)
    } finally {
      globalThis.Image = OriginalImage
    }
  })

  it('naturalWidth 为 0 时 fallback 到 NODE_WIDTH', async () => {
    const { img, triggerOnload } = createMockImage(0, 100)
    const OriginalImage = globalThis.Image

    // @ts-expect-error 替换全局 Image 构造函数
    globalThis.Image = function () {
      queueMicrotask(() => triggerOnload())
      return img
    }

    try {
      const file = new File([''], 'broken.jpg', { type: 'image/jpeg' })
      const height = await getImageFileHeight(file)
      expect(height).toBe(NODE_WIDTH)
    } finally {
      globalThis.Image = OriginalImage
    }
  })

  it('onerror 时 fallback 到 NODE_WIDTH', async () => {
    const { img, triggerOnerror } = createMockImage(0, 0)
    const OriginalImage = globalThis.Image

    // @ts-expect-error 替换全局 Image 构造函数
    globalThis.Image = function () {
      queueMicrotask(() => triggerOnerror())
      return img
    }

    try {
      const file = new File([''], 'bad.jpg', { type: 'image/jpeg' })
      const height = await getImageFileHeight(file)
      expect(height).toBe(NODE_WIDTH)
    } finally {
      globalThis.Image = OriginalImage
    }
  })

  it('正方形图片返回 NODE_WIDTH', async () => {
    const { img, triggerOnload } = createMockImage(320, 320)
    const OriginalImage = globalThis.Image

    // @ts-expect-error 替换全局 Image 构造函数
    globalThis.Image = function () {
      queueMicrotask(() => triggerOnload())
      return img
    }

    try {
      const file = new File([''], 'square.jpg', { type: 'image/jpeg' })
      const height = await getImageFileHeight(file)
      expect(height).toBe(NODE_WIDTH) // ratio = 1
    } finally {
      globalThis.Image = OriginalImage
    }
  })
})
