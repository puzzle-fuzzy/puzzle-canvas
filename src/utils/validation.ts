/** 危险文件扩展名（与后端一致） */
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'dll', 'sys', 'vxd',
  'vbs', 'vbe', 'wsf', 'wsh', 'ps1', 'psm1',
  'jar', 'class',
  'inf', 'reg', 'lnk', 'desktop',
  'app', 'dmg', 'pkg',
  'iso', 'img',
  'hta', 'cpl',
])

/** 判断文件是否为危险类型（检查所有扩展名，防止双扩展名绕过） */
export function isDangerousFile(fileName: string): boolean {
  const parts = fileName.toLowerCase().split('.')
  // 检查每个扩展名段（跳过第一个，它是文件名主体）
  for (let i = 1; i < parts.length; i++) {
    if (DANGEROUS_EXTENSIONS.has(parts[i])) return true
  }
  return false
}

/** 校验字符串是否为合法 HTTP/HTTPS URL */
export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

/** 从 URL 提取域名用于显示 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
