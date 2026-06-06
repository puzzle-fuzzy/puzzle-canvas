import { vi } from 'vitest'

// jsdom 不提供 URL.createObjectURL / revokeObjectURL
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn()
}

// 确保 crypto.subtle 可用（upload fingerprint 测试需要）
if (!globalThis.crypto?.subtle) {
  globalThis.crypto = {
    ...globalThis.crypto,
    subtle: {
      digest: vi.fn(async () => new ArrayBuffer(32)),
    } as unknown as SubtleCrypto,
  }
}
