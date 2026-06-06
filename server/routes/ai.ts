/**
 * AI 生图路由模块（预留）
 *
 *   POST /api/generate-image
 *
 * 当前返回 501 未实现，待接入实际 AI 生图服务后替换。
 * 注释中保留了 OpenAI DALL-E 3 的调用示例作为参考。
 */
import type { Hono } from 'hono'

export function registerAIRoutes(app: Hono) {
  app.post('/api/generate-image', async (c) => {
    const body = await c.req.json()
    const { prompt } = body

    if (!prompt) {
      return c.json({ error: '缺少 prompt 参数' }, 400)
    }

    // TODO: 接入实际 AI 生图服务
    // 示例：调用 OpenAI DALL-E 3 API
    // const response = await fetch('https://api.openai.com/v1/images/generations', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     model: model || 'dall-e-3',
    //     prompt,
    //     n: 1,
    //     size: '1024x1024',
    //   }),
    // })
    // const data = await response.json()
    // const imageUrl = data.data[0].url
    // 下载图片并保存到本地
    // const imgRes = await fetch(imageUrl)
    // const ext = 'png'
    // const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    // await Bun.write(`./uploads/${uniqueName}`, imgRes)
    // return c.json({ src: `/uploads/${uniqueName}`, prompt, model })

    return c.json({ error: 'AI 生图服务尚未配置' }, 501)
  })
}
