/**
 * 服务端入口
 *
 * 创建 Hono 实例，注册全局中间件（CORS、错误处理），
 * 挂载各业务路由模块，并提供静态文件服务。
 *
 * 生产模式下同时提供前端构建产物（dist/）的静态服务 + SPA fallback。
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'

// 导入上传工具模块（副作用：创建上传目录 + 启动临时文件清理）
import './utils/upload'

// 路由模块
import { createAuthRoutes } from './routes/auth'
import { createNodeRoutes } from './routes/nodes'
import { createUploadRoutes } from './routes/upload'
import { createMetadataRoutes } from './routes/metadata'
import { createAIRoutes } from './routes/ai'
import { createShareRoutes } from './routes/shares'

// 认证中间件
import { createAuthMiddleware } from './middleware/auth'

const app = new Hono()

// ===== 启动日志 =====
const PORT = 4001
const isProd = process.env.NODE_ENV === 'production'
console.log(`\n🚀 Puzzle Canvas 服务启动`)
console.log(`   环境: ${isProd ? '生产' : '开发'}`)
console.log(`   端口: ${PORT}`)
console.log(`   前端: ${Bun.file('./dist/index.html').size > 0 ? '✅ dist/ 已构建' : '⚠️  dist/ 不存在，请先运行 bun run build'}\n`)

// CORS：显式白名单，防止跨域攻击
app.use('*', cors({
  origin: ['http://localhost:5175', 'http://localhost:4001'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}))

// 全局错误处理：捕获未处理的异常，返回 JSON 错误响应
app.onError((err, c) => {
  console.error('Server error:', err)
  // JSON 解析错误返回 400，而非默认的 500
  if (err instanceof SyntaxError) {
    return c.json({ error: '请求体 JSON 格式错误' }, 400)
  }
  // 生产环境不暴露内部错误详情，避免泄露 SQL 语句、文件路径等
  const message = process.env.NODE_ENV === 'production'
    ? '服务器内部错误'
    : err.message || '服务器内部错误'
  return c.json({ error: message }, 500)
})

// ===== 静态文件服务 =====

// 上传文件：/uploads/* → ./uploads/*
// 添加安全头，防止上传的 HTML/SVG 在同源执行 JS（存储型 XSS）
app.use('/uploads/*', async (c, next) => {
  await next()
  const res = c.res
  if (res.status === 200) {
    res.headers.set('X-Content-Type-Options', 'nosniff')
    res.headers.set('Content-Disposition', 'attachment')
  }
})
app.use('/uploads/*', serveStatic({ root: './' }))

// ===== 业务路由 =====

app.route('/api/auth', createAuthRoutes())             // 认证（注册/登录/刷新/登出/me）

const auth = createAuthMiddleware()
app.route('/api/nodes', createNodeRoutes({ auth }))    // 节点 CRUD（需认证）
app.route('/api/upload', createUploadRoutes({ auth })) // 文件上传（需认证）
app.route('/api/metadata', createMetadataRoutes())     // URL 元数据提取（公开）
app.route('/api/generate-image', createAIRoutes())     // AI 生图（预留）
app.route('/api/shares', createShareRoutes({ auth }))  // 节点分享（创建需认证，查询公开）

// ===== 前端静态服务（生产模式）=====

// 静态资源（JS / CSS / 图片等）
app.use('/*', serveStatic({ root: './dist' }))

// SPA fallback：非 API / 非静态资源请求返回 index.html
app.get('*', async (c) => {
  const file = Bun.file('./dist/index.html')
  if (await file.exists()) {
    return new Response(file)
  }
  return c.text('Frontend not built. Run `bun run build` first.', 404)
})

export default {
  port: 4001,
  fetch: app.fetch,
}
