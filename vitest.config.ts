/**
 * Vitest 前端测试配置
 *
 * 前端测试（src/）使用 vitest + jsdom 环境，
 * 后端测试（server/）使用 bun:test，由 `bun test server/` 独立运行。
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
  },
})
