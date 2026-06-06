/**
 * 上传路由集成测试
 */
import { describe, it, expect, beforeEach } from 'bun:test'
import { createTestApp } from '../setup'
import { uploadSessions } from '../../utils/upload'
import type { Hono } from 'hono'

describe('上传路由', () => {
  let app: Hono

  beforeEach(() => {
    const test = createTestApp()
    app = test.app
    // 清理上传会话，避免测试间状态泄漏
    uploadSessions.clear()
  })

  // ===== POST /api/upload/init =====

  describe('POST /api/upload/init', () => {
    const validInit = {
      fileName: 'photo.jpg',
      fileSize: 1024,
      totalChunks: 3,
      fingerprint: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    }

    it('正常初始化上传', async () => {
      const res = await app.request('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validInit),
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.uploadId).toBeDefined()
      expect(data.existingChunks).toEqual([])
    })

    it('缺少 fileName 返回 400', async () => {
      const { fileName: _, ...withoutName } = validInit
      const res = await app.request('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withoutName),
      })
      expect(res.status).toBe(400)
    })

    it('危险文件类型返回 400', async () => {
      const res = await app.request('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validInit, fileName: 'virus.exe' }),
      })
      expect(res.status).toBe(400)
    })

    it('文件过大返回 413', async () => {
      const res = await app.request('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validInit, fileSize: 900 * 1024 * 1024 }),
      })
      expect(res.status).toBe(413)
    })

    it('totalChunks 为 0 返回 400', async () => {
      const res = await app.request('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validInit, totalChunks: 0 }),
      })
      expect(res.status).toBe(400)
    })

    it('totalChunks 为负数返回 400', async () => {
      const res = await app.request('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validInit, totalChunks: -1 }),
      })
      expect(res.status).toBe(400)
    })

    it('totalChunks 为小数返回 400', async () => {
      const res = await app.request('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validInit, totalChunks: 2.5 }),
      })
      expect(res.status).toBe(400)
    })

    it('fileSize 为字符串返回 400', async () => {
      const res = await app.request('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validInit, fileSize: 'abc' }),
      })
      expect(res.status).toBe(400)
    })

    it('fingerprint 含路径遍历返回 400', async () => {
      const res = await app.request('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validInit, fingerprint: '../../etc/passwd' }),
      })
      expect(res.status).toBe(400)
    })

    it('fingerprint 含大写字母返回 400', async () => {
      const res = await app.request('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validInit, fingerprint: 'ABC123' }),
      })
      expect(res.status).toBe(400)
    })

    it('fingerprint 含点号返回 400', async () => {
      const res = await app.request('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validInit, fingerprint: 'abc.def' }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ===== PUT /api/upload/chunk =====

  describe('PUT /api/upload/chunk', () => {
    it('无效的 uploadId 返回 400', async () => {
      const formData = new FormData()
      formData.append('uploadId', 'nonexistent')
      formData.append('chunkIndex', '0')
      formData.append('chunk', new File(['data'], 'chunk.bin'))

      const res = await app.request('/api/upload/chunk', {
        method: 'PUT',
        body: formData,
      })
      expect(res.status).toBe(400)
    })
  })

  // ===== POST /api/upload/complete =====

  describe('POST /api/upload/complete', () => {
    it('无效的 uploadId 返回 400', async () => {
      const res = await app.request('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: 'nonexistent', fileName: 'test.jpg' }),
      })
      expect(res.status).toBe(400)
    })

    it('缺少 fileName 返回 400', async () => {
      const sessionId = 'test-session-id'
      uploadSessions.set(sessionId, {
        fingerprint: 'a1b2c3d4',
        totalChunks: 1,
        createdAt: Date.now(),
      })

      const res = await app.request('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: sessionId }),
      })
      expect(res.status).toBe(400)
    })

    it('fileName 为危险类型返回 400', async () => {
      const sessionId = 'test-session-id'
      uploadSessions.set(sessionId, {
        fingerprint: 'a1b2c3d4',
        totalChunks: 1,
        createdAt: Date.now(),
      })

      const res = await app.request('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: sessionId, fileName: 'virus.exe' }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ===== DELETE /api/upload/cancel =====

  describe('DELETE /api/upload/cancel', () => {
    it('无效的 uploadId 返回 400', async () => {
      const res = await app.request('/api/upload/cancel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: 'nonexistent' }),
      })
      expect(res.status).toBe(400)
    })

    it('有效 uploadId 取消成功', async () => {
      const sessionId = 'cancel-test-id'
      uploadSessions.set(sessionId, {
        fingerprint: 'deadbeef',
        totalChunks: 2,
        createdAt: Date.now(),
      })

      const res = await app.request('/api/upload/cancel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: sessionId }),
      })
      expect(res.status).toBe(200)
      expect(uploadSessions.has(sessionId)).toBe(false)
    })
  })

  // ===== POST /api/upload (简单上传) =====

  describe('POST /api/upload', () => {
    it('未提供文件返回 400', async () => {
      const formData = new FormData()
      const res = await app.request('/api/upload', {
        method: 'POST',
        body: formData,
      })
      expect(res.status).toBe(400)
    })

    it('危险文件类型返回 400', async () => {
      const formData = new FormData()
      formData.append('file', new File(['data'], 'virus.exe'))

      const res = await app.request('/api/upload', {
        method: 'POST',
        body: formData,
      })
      expect(res.status).toBe(400)
    })
  })
})
