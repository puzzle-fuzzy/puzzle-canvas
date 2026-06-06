/**
 * 上传路由集成测试
 *
 * 使用 hono/testing 的 testClient 进行类型安全的端到端测试，
 * 无需手动类型断言，响应体类型由路由定义自动推断。
 */
import { describe, it, expect } from 'bun:test'
import { testClient } from 'hono/testing'
import { createTestApp, type TestApp } from '../setup'
import { uploadSessions } from '../../utils/upload'

describe('上传路由', () => {
  const setup = () => {
    const { app } = createTestApp()
    // 清理上传会话，避免测试间状态泄漏
    uploadSessions.clear()
    return testClient<TestApp>(app)
  }

  // ===== POST /api/upload/init =====

  describe('POST /api/upload/init', () => {
    const validInit = {
      fileName: 'photo.jpg',
      fileSize: 1024,
      totalChunks: 3,
      fingerprint: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    }

    it('正常初始化上传', async () => {
      const client = setup()
      const res = await client.api.upload.init.$post({
        json: validInit,
      })
      expect(res.status).toBe(200)
      const data = await res.json() as Record<string, any>
      expect(data.uploadId).toBeDefined()
      expect(data.existingChunks).toEqual([])
    })

    it('缺少 fileName 返回 400', async () => {
      const client = setup()
      const { fileName: _, ...withoutName } = validInit
      const res = await client.api.upload.init.$post({
        json: withoutName,
      })
      expect(res.status).toBe(400)
    })

    it('危险文件类型返回 400', async () => {
      const client = setup()
      const res = await client.api.upload.init.$post({
        json: { ...validInit, fileName: 'virus.exe' },
      })
      expect(res.status).toBe(400)
    })

    it('文件过大返回 413', async () => {
      const client = setup()
      const res = await client.api.upload.init.$post({
        json: { ...validInit, fileSize: 900 * 1024 * 1024 },
      })
      expect(res.status).toBe(413)
    })

    it('totalChunks 为 0 返回 400', async () => {
      const client = setup()
      const res = await client.api.upload.init.$post({
        json: { ...validInit, totalChunks: 0 },
      })
      expect(res.status).toBe(400)
    })

    it('totalChunks 为负数返回 400', async () => {
      const client = setup()
      const res = await client.api.upload.init.$post({
        json: { ...validInit, totalChunks: -1 },
      })
      expect(res.status).toBe(400)
    })

    it('totalChunks 为小数返回 400', async () => {
      const client = setup()
      const res = await client.api.upload.init.$post({
        json: { ...validInit, totalChunks: 2.5 },
      })
      expect(res.status).toBe(400)
    })

    it('fileSize 为字符串返回 400', async () => {
      const client = setup()
      const res = await client.api.upload.init.$post({
        json: { ...validInit, fileSize: 'abc' } as unknown as typeof validInit,
      })
      expect(res.status).toBe(400)
    })

    it('fingerprint 含路径遍历返回 400', async () => {
      const client = setup()
      const res = await client.api.upload.init.$post({
        json: { ...validInit, fingerprint: '../../etc/passwd' },
      })
      expect(res.status).toBe(400)
    })

    it('fingerprint 含大写字母返回 400', async () => {
      const client = setup()
      const res = await client.api.upload.init.$post({
        json: { ...validInit, fingerprint: 'ABC123' },
      })
      expect(res.status).toBe(400)
    })

    it('fingerprint 含点号返回 400', async () => {
      const client = setup()
      const res = await client.api.upload.init.$post({
        json: { ...validInit, fingerprint: 'abc.def' },
      })
      expect(res.status).toBe(400)
    })
  })

  // ===== PUT /api/upload/chunk =====

  describe('PUT /api/upload/chunk', () => {
    it('无效的 uploadId 返回 400', async () => {
      const client = setup()
      const formData = new FormData()
      formData.append('uploadId', 'nonexistent')
      formData.append('chunkIndex', '0')
      formData.append('chunk', new File(['data'], 'chunk.bin'))

      const res = await client.api.upload.chunk.$put({
        body: formData,
      } as unknown as Parameters<typeof client.api.upload.chunk.$put>[0])
      expect(res.status).toBe(400)
    })
  })

  // ===== POST /api/upload/complete =====

  describe('POST /api/upload/complete', () => {
    it('无效的 uploadId 返回 400', async () => {
      const client = setup()
      const res = await client.api.upload.complete.$post({
        json: { uploadId: 'nonexistent', fileName: 'test.jpg' },
      })
      expect(res.status).toBe(400)
    })

    it('缺少 fileName 返回 400', async () => {
      const client = setup()
      const sessionId = 'test-session-id'
      uploadSessions.set(sessionId, {
        fingerprint: 'a1b2c3d4',
        totalChunks: 1,
        createdAt: Date.now(),
      })

      const res = await client.api.upload.complete.$post({
        json: { uploadId: sessionId } as unknown as { uploadId: string; fileName: string },
      })
      expect(res.status).toBe(400)
    })

    it('fileName 为危险类型返回 400', async () => {
      const client = setup()
      const sessionId = 'test-session-id'
      uploadSessions.set(sessionId, {
        fingerprint: 'a1b2c3d4',
        totalChunks: 1,
        createdAt: Date.now(),
      })

      const res = await client.api.upload.complete.$post({
        json: { uploadId: sessionId, fileName: 'virus.exe' },
      })
      expect(res.status).toBe(400)
    })
  })

  // ===== DELETE /api/upload/cancel =====

  describe('DELETE /api/upload/cancel', () => {
    it('无效的 uploadId 返回 400', async () => {
      const client = setup()
      const res = await client.api.upload.cancel.$delete({
        json: { uploadId: 'nonexistent' },
      })
      expect(res.status).toBe(400)
    })

    it('有效 uploadId 取消成功', async () => {
      const client = setup()
      const sessionId = 'cancel-test-id'
      uploadSessions.set(sessionId, {
        fingerprint: 'deadbeef',
        totalChunks: 2,
        createdAt: Date.now(),
      })

      const res = await client.api.upload.cancel.$delete({
        json: { uploadId: sessionId },
      })
      expect(res.status).toBe(200)
      expect(uploadSessions.has(sessionId)).toBe(false)
    })
  })

  // ===== POST /api/upload (简单上传) =====

  describe('POST /api/upload', () => {
    it('未提供文件返回 400', async () => {
      const client = setup()
      const formData = new FormData()

      const res = await client.api.upload.$post({
        body: formData,
      } as unknown as Parameters<typeof client.api.upload.$post>[0])
      expect(res.status).toBe(400)
    })

    it('危险文件类型返回 400', async () => {
      const client = setup()
      const formData = new FormData()
      formData.append('file', new File(['data'], 'virus.exe'))

      const res = await client.api.upload.$post({
        body: formData,
      } as unknown as Parameters<typeof client.api.upload.$post>[0])
      expect(res.status).toBe(400)
    })
  })
})
