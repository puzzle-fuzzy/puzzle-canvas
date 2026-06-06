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
import { registerNodeRoutes } from './routes/nodes'
import { registerUploadRoutes } from './routes/upload'
import { registerMetadataRoutes } from './routes/metadata'
import { registerAIRoutes } from './routes/ai'

const app = new Hono()

// ===== 全局中间件 =====

// CORS：允许所有来源，适配本地开发和生产部署
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}))

// 全局错误处理：捕获未处理的异常，返回 JSON 错误响应
app.onError((err, c) => {
  console.error('Server error:', err)
  // JSON 解析错误返回 400，而非默认的 500
  if (err instanceof SyntaxError) {
    return c.json({ error: '请求体 JSON 格式错误' }, 400)
  }
  return c.json({ error: err.message || '服务器内部错误' }, 500)
})

// ===== 静态文件服务 =====

// 上传文件：/uploads/* → ./uploads/*
app.use('/uploads/*', serveStatic({ root: './' }))

// ===== 业务路由 =====

registerNodeRoutes(app)        // 节点 CRUD
registerUploadRoutes(app)      // 文件上传（分片 + 简单）
registerMetadataRoutes(app)    // URL 元数据提取
registerAIRoutes(app)          // AI 生图（预留）

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
  port: 3001,
  fetch: app.fetch,
}
