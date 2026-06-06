import { describe, it, expect } from 'vitest'
import { isDangerousFile, isValidUrl, getDomain } from './validation'

describe('isDangerousFile', () => {
  it('检测危险扩展名', () => {
    expect(isDangerousFile('malware.exe')).toBe(true)
    expect(isDangerousFile('setup.msi')).toBe(true)
    expect(isDangerousFile('script.ps1')).toBe(true)
    expect(isDangerousFile('archive.jar')).toBe(true)
    expect(isDangerousFile('app.dmg')).toBe(true)
    expect(isDangerousFile('screen.scr')).toBe(true)
    expect(isDangerousFile('driver.sys')).toBe(true)
    expect(isDangerousFile('config.reg')).toBe(true)
  })

  it('安全文件返回 false', () => {
    expect(isDangerousFile('photo.jpg')).toBe(false)
    expect(isDangerousFile('document.pdf')).toBe(false)
    expect(isDangerousFile('video.mp4')).toBe(false)
    expect(isDangerousFile('image.png')).toBe(false)
    expect(isDangerousFile('data.json')).toBe(false)
  })

  it('双扩展名绕过检测', () => {
    expect(isDangerousFile('photo.exe.jpg')).toBe(true)
    expect(isDangerousFile('archive.tar.gz')).toBe(false) // gz 不在危险列表
    expect(isDangerousFile('file.jar.exe.txt')).toBe(true)
  })

  it('大小写不敏感', () => {
    expect(isDangerousFile('FILE.EXE')).toBe(true)
    expect(isDangerousFile('Setup.MSI')).toBe(true)
    expect(isDangerousFile('Script.PS1')).toBe(true)
  })

  it('无扩展名和边界情况', () => {
    expect(isDangerousFile('Makefile')).toBe(false)
    expect(isDangerousFile('.hidden')).toBe(false)
    expect(isDangerousFile('')).toBe(false)
    expect(isDangerousFile('...')).toBe(false)
  })
})

describe('isValidUrl', () => {
  it('接受合法 HTTP/HTTPS URL', () => {
    expect(isValidUrl('https://example.com')).toBe(true)
    expect(isValidUrl('http://example.com')).toBe(true)
    expect(isValidUrl('https://example.com/path?q=1#hash')).toBe(true)
    expect(isValidUrl('http://localhost:3001')).toBe(true)
  })

  it('拒绝非 HTTP 协议', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false)
    expect(isValidUrl('javascript:alert(1)')).toBe(false)
    expect(isValidUrl('data:text/html,<h1>hi</h1>')).toBe(false)
  })

  it('拒绝非 URL 字符串', () => {
    expect(isValidUrl('not a url')).toBe(false)
    expect(isValidUrl('')).toBe(false)
    expect(isValidUrl('example.com')).toBe(false)
  })

  it('空 hostname 的 URL 返回 false', () => {
    // 浏览器中 new URL('https://') 不抛错但 hostname 为空
    // Node/jsdom 中直接抛异常
    // 两种情况都应返回 false
    expect(isValidUrl('https://')).toBe(false)
  })
})

describe('getDomain', () => {
  it('提取域名', () => {
    expect(getDomain('https://example.com/path')).toBe('example.com')
    expect(getDomain('http://sub.example.com/page')).toBe('sub.example.com')
  })

  it('去除端口', () => {
    expect(getDomain('https://example.com:8080/path')).toBe('example.com')
  })

  it('无效 URL 原样返回', () => {
    expect(getDomain('not-a-url')).toBe('not-a-url')
    expect(getDomain('')).toBe('')
  })

  it('IP 地址', () => {
    expect(getDomain('http://192.168.1.1')).toBe('192.168.1.1')
  })
})
