/**
 * AI 生图路由测试（桩）
 *
 * 使用 hono/testing 的 testClient 进行类型安全的端到端测试，
 * 无需手动类型断言。
 */
import { describe, it, expect } from 'bun:test'
import { testClient } from 'hono/testing'
import { createTestApp, type TestApp } from '../setup'

describe('POST /api/generate-image', () => {
  const setup = () => {
    const { app } = createTestApp()
    return testClient<TestApp>(app)
  }

  it('缺少 prompt 返回 400', async () => {
    const client = setup()
    const res = await client.api['generate-image'].$post({
      json: {} as Record<string, unknown>,
    })
    expect(res.status).toBe(400)
  })

  it('有 prompt 返回 501（未实现）', async () => {
    const client = setup()
    const res = await client.api['generate-image'].$post({
      json: { prompt: '一只可爱的猫咪' },
    })
    expect(res.status).toBe(501)
  })
})
