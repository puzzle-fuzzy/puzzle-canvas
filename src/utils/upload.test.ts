import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerUploadController, cancelUpload } from './upload'

describe('registerUploadController + cancelUpload', () => {
  beforeEach(() => {
    // 每个测试前清空模块级 Map（通过 cancel 所有已注册的）
    // 由于 Map 是私有的，我们通过功能测试验证
  })

  it('注册后可以取消', () => {
    const controller = new AbortController()
    const spy = vi.spyOn(controller, 'abort')

    registerUploadController('node-1', controller)
    cancelUpload('node-1')

    expect(spy).toHaveBeenCalled()
  })

  it('重复注册同一 nodeId 时中止旧控制器', () => {
    const controller1 = new AbortController()
    const controller2 = new AbortController()
    const spy1 = vi.spyOn(controller1, 'abort')

    registerUploadController('node-1', controller1)
    registerUploadController('node-1', controller2)

    expect(spy1).toHaveBeenCalled()
  })

  it('取消不存在的 nodeId 不报错', () => {
    expect(() => cancelUpload('nonexistent')).not.toThrow()
  })

  it('取消后再次取消不报错', () => {
    const controller = new AbortController()
    registerUploadController('node-2', controller)
    cancelUpload('node-2')
    expect(() => cancelUpload('node-2')).not.toThrow()
  })
})
