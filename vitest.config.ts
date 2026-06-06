/**
 * Vitest 基础配置
 *
 * 前后端测试分离由 vitest.workspace.ts 管理，
 * 此文件仅作为各 workspace project 的基础默认值。
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
  
})
