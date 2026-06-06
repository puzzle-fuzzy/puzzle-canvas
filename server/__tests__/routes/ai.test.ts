/**
 * AI 生图路由测试（桩）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestApp } from '../setup'
import type { Hono } from 'hono'

describe('POST /api/generate-image', () => {
  let app: Hono

  beforeEach(() => {
    const test = createTestApp()
    app = test.app
  })

  it('缺少 prompt 返回 400', async () => {
    const res = await app.request('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('有 prompt 返回 501（未实现）', async () => {
    const res = await app.request('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '一只可爱的猫咪' }),
    })
    expect(res.status).toBe(501)
  })
})
