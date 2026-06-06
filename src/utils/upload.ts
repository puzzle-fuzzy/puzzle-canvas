import type { UploadInitResponse } from '../types'
import { getApiUrl } from './api'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB

/** 计算文件指纹：SHA-256(前 2MB) + fileSize */
async function computeFileFingerprint(file: File): Promise<string> {
  const sampleSize = Math.min(2 * 1024 * 1024, file.size)
  const sample = await file.slice(0, sampleSize).arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', sample)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex}-${file.size}`
}

/** 上传控制器（按 nodeId 存储） */
const uploadControllers = new Map<string, AbortController>()

export function registerUploadController(nodeId: string, controller: AbortController) {
  uploadControllers.set(nodeId, controller)
}

/** 取消指定节点的上传 */
export function cancelUpload(nodeId: string) {
  const controller = uploadControllers.get(nodeId)
  if (controller) {
    controller.abort()
    uploadControllers.delete(nodeId)
  }
}

/** 分片上传：带进度、重试、断点续传 */
export async function uploadFileChunked(
  file: File,
  options: {
    onProgress?: (progress: number) => void
    signal?: AbortSignal
  } = {},
): Promise<{ src: string; fileName: string; mediaType: 'image' | 'video' }> {
  const { onProgress, signal } = options

  // 1. 计算指纹
  const fingerprint = await computeFileFingerprint(file)
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE))

  // 2. 初始化
  signal?.throwIfAborted()
  const initRes = await fetch(getApiUrl('/api/upload/init'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      fingerprint,
    }),
    signal,
  })
  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({ error: '上传初始化失败' }))
    throw new Error(err.error ?? `上传初始化失败 (${initRes.status})`)
  }
  const { uploadId, existingChunks }: UploadInitResponse = await initRes.json()
  const uploadedSet = new Set(existingChunks)

  // 3. 逐片上传（跳过已有分片）
  for (let i = 0; i < totalChunks; i++) {
    signal?.throwIfAborted()

    // 断点续传：跳过已上传的分片
    if (uploadedSet.has(i)) {
      onProgress?.((i + 1) / totalChunks)
      continue
    }

    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunkBlob = file.slice(start, end)

    // 重试逻辑（3 次，指数退避）
    const MAX_RETRIES = 3
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      signal?.throwIfAborted()
      try {
        const formData = new FormData()
        formData.append('uploadId', uploadId)
        formData.append('chunkIndex', String(i))
        formData.append('chunk', chunkBlob, file.name)

        const chunkRes = await fetch(getApiUrl('/api/upload/chunk'), {
          method: 'PUT',
          body: formData,
          signal,
        })

        if (chunkRes.ok) {
          lastError = null
          break
        }
        lastError = new Error(`分片 ${i} 上传失败 (${chunkRes.status})`)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }

      // 等待后重试（指数退避 1s, 2s, 4s）
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
      }
    }

    if (lastError) throw lastError

    onProgress?.((i + 1) / totalChunks)
  }

  // 4. 完成合并
  signal?.throwIfAborted()
  const completeRes = await fetch(getApiUrl('/api/upload/complete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, fileName: file.name }),
    signal,
  })
  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({ error: '合并失败' }))
    throw new Error(err.error ?? `合并失败 (${completeRes.status})`)
  }

  return await completeRes.json()
}
