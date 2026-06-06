/**
 * Vitest Workspace 配置
 *
 * 前后端测试分离：
 *   - 前端（src/）：jsdom 环境，React 组件测试
 *   - 后端（server/）：Node 环境，API 路由 + 工具函数测试
 */
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      name: 'frontend',
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test-setup.ts'],
    },
  },
  {
    test: {
      name: 'server',
      include: ['server/**/*.test.ts'],
    },
  },
])
