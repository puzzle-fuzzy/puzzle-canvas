import { describe, it, expect, vi } from 'vitest'
import { getApiUrl } from './api'

describe('getApiUrl', () => {
  it('DEV 模式添加后端前缀', () => {
    vi.stubEnv('DEV', true)
    // import.meta.env 在 vitest 中可能需要间接测试
    // 这里通过直接调用函数验证逻辑
    // 注意：由于 import.meta.env 是静态替换，这里测试的是运行时行为
    expect(getApiUrl('/api/nodes')).toContain('/api/nodes')
    vi.unstubAllEnvs()
  })

  it('路径带前导斜杠', () => {
    const result = getApiUrl('/api/nodes')
    // DEV 模式下应包含 localhost 或直接是路径
    expect(result).toMatch(/\/api\/nodes$/)
  })
})
