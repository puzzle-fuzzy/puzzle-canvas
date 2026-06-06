import { describe, it, expect } from 'vitest'
import { formatFileSize } from './format'

describe('formatFileSize', () => {
  it('0 字节', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('字节级别', () => {
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(1)).toBe('1 B')
    expect(formatFileSize(1023)).toBe('1023 B')
  })

  it('KB 级别', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(1024 * 100)).toBe('100.0 KB')
  })

  it('MB 级别', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(1024 * 1024 * 5.5)).toBe('5.5 MB')
  })

  it('GB 级别', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB')
    expect(formatFileSize(1024 * 1024 * 1024 * 3)).toBe('3.0 GB')
  })

  it('负数 fallback 到 0 B', () => {
    expect(formatFileSize(-1)).toBe('0 B')
    expect(formatFileSize(-100)).toBe('0 B')
  })

  it('NaN fallback 到 0 B', () => {
    expect(formatFileSize(NaN)).toBe('0 B')
  })

  it('Infinity fallback 到 0 B', () => {
    expect(formatFileSize(Infinity)).toBe('0 B')
    expect(formatFileSize(-Infinity)).toBe('0 B')
  })
})
