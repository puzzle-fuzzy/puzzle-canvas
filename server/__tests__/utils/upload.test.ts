/**
 * isDangerousFile 工具函数单元测试
 */
import { describe, it, expect } from 'bun:test'
import { isDangerousFile, isValidFingerprint, isSafeFileName, DANGEROUS_EXTENSIONS } from '../../utils/upload'

describe('isDangerousFile', () => {
  it('正常安全文件返回 false', () => {
    expect(isDangerousFile('photo.jpg')).toBe(false)
    expect(isDangerousFile('document.pdf')).toBe(false)
    expect(isDangerousFile('video.mp4')).toBe(false)
    expect(isDangerousFile('data.json')).toBe(false)
  })

  it('无扩展名文件返回 false', () => {
    expect(isDangerousFile('README')).toBe(false)
    expect(isDangerousFile('Makefile')).toBe(false)
  })

  it('空字符串返回 false', () => {
    expect(isDangerousFile('')).toBe(false)
  })

  it('点文件无危险扩展名返回 false', () => {
    expect(isDangerousFile('.gitignore')).toBe(false)
    expect(isDangerousFile('.env')).toBe(false)
  })

  it('检测 Windows 可执行文件', () => {
    expect(isDangerousFile('setup.exe')).toBe(true)
    expect(isDangerousFile('run.bat')).toBe(true)
    expect(isDangerousFile('script.cmd')).toBe(true)
    expect(isDangerousFile('program.com')).toBe(true)
    expect(isDangerousFile('screensaver.scr')).toBe(true)
    expect(isDangerousFile('installer.msi')).toBe(true)
    expect(isDangerousFile('library.dll')).toBe(true)
  })

  it('检测脚本文件', () => {
    expect(isDangerousFile('script.vbs')).toBe(true)
    expect(isDangerousFile('script.ps1')).toBe(true)
    expect(isDangerousFile('module.psm1')).toBe(true)
    expect(isDangerousFile('task.wsf')).toBe(true)
  })

  it('检测 Java 文件', () => {
    expect(isDangerousFile('app.jar')).toBe(true)
    expect(isDangerousFile('Main.class')).toBe(true)
  })

  it('检测系统配置/快捷方式', () => {
    expect(isDangerousFile('shortcut.lnk')).toBe(true)
    expect(isDangerousFile('fix.reg')).toBe(true)
    expect(isDangerousFile('config.inf')).toBe(true)
  })

  it('检测 macOS 安装包', () => {
    expect(isDangerousFile('installer.dmg')).toBe(true)
    expect(isDangerousFile('package.pkg')).toBe(true)
    expect(isDangerousFile('MyApp.app')).toBe(true)
  })

  it('检测磁盘映像', () => {
    expect(isDangerousFile('disk.iso')).toBe(true)
    expect(isDangerousFile('disk.img')).toBe(true)
  })

  it('大小写不敏感', () => {
    expect(isDangerousFile('Virus.EXE')).toBe(true)
    expect(isDangerousFile('FILE.BAT')).toBe(true)
    expect(isDangerousFile('Setup.DMG')).toBe(true)
  })

  it('多段扩展名中含危险后缀被检测到', () => {
    // .exe 在黑名单中，会被检测到
    expect(isDangerousFile('file.tar.exe')).toBe(true)
    // .app 在黑名单中
    expect(isDangerousFile('archive.tar.app')).toBe(true)
  })

  it('多段扩展名中无危险后缀返回 false', () => {
    // .gz 不在黑名单中
    expect(isDangerousFile('archive.tar.gz')).toBe(false)
    expect(isDangerousFile('photo.backup.jpg')).toBe(false)
  })

  it('仅扩展名（以点开头）也能检测', () => {
    expect(isDangerousFile('.exe')).toBe(true)
  })

  it('非危险的多段扩展名返回 false', () => {
    expect(isDangerousFile('exe.config')).toBe(false)
    expect(isDangerousFile('app.config')).toBe(false)
  })
})

describe('isValidFingerprint', () => {
  it('合法的 SHA-256 hex 指纹', () => {
    expect(isValidFingerprint('abc123')).toBe(true)
    expect(isValidFingerprint('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')).toBe(true)
    expect(isValidFingerprint('deadbeef')).toBe(true)
  })

  it('空字符串不合法', () => {
    expect(isValidFingerprint('')).toBe(false)
  })

  it('含路径分隔符不合法', () => {
    expect(isValidFingerprint('../etc/passwd')).toBe(false)
    expect(isValidFingerprint('foo/bar')).toBe(false)
    expect(isValidFingerprint('foo\\bar')).toBe(false)
  })

  it('含空字节不合法', () => {
    expect(isValidFingerprint('foo\x00bar')).toBe(false)
  })

  it('含大写字母不合法', () => {
    expect(isValidFingerprint('ABC123')).toBe(false)
  })

  it('含非 hex 字符不合法', () => {
    expect(isValidFingerprint('xyz789')).toBe(false)
    expect(isValidFingerprint('g')).toBe(false)
  })

  it('含点号不合法', () => {
    expect(isValidFingerprint('abc.def')).toBe(false)
  })
})

describe('isSafeFileName', () => {
  it('合法文件名', () => {
    expect(isSafeFileName('photo.jpg')).toBe(true)
    expect(isSafeFileName('my file.png')).toBe(true)
    expect(isSafeFileName('中文文件名.pdf')).toBe(true)
  })

  it('空字符串不合法', () => {
    expect(isSafeFileName('')).toBe(false)
  })

  it('含路径分隔符不合法', () => {
    expect(isSafeFileName('../etc/passwd')).toBe(false)
    expect(isSafeFileName('foo/bar.txt')).toBe(false)
    expect(isSafeFileName('foo\\bar.txt')).toBe(false)
  })

  it('含空字节不合法', () => {
    expect(isSafeFileName('file\x00.txt')).toBe(false)
  })
})

describe('DANGEROUS_EXTENSIONS', () => {
  it('包含常见的危险扩展名', () => {
    expect(DANGEROUS_EXTENSIONS.has('exe')).toBe(true)
    expect(DANGEROUS_EXTENSIONS.has('bat')).toBe(true)
    expect(DANGEROUS_EXTENSIONS.has('app')).toBe(true)
    expect(DANGEROUS_EXTENSIONS.has('dmg')).toBe(true)
    expect(DANGEROUS_EXTENSIONS.has('jar')).toBe(true)
    expect(DANGEROUS_EXTENSIONS.has('lnk')).toBe(true)
  })
})
