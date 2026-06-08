/**
 * 分享路由模块
 *
 *   POST /         — 创建分享（需认证）
 *   GET  /:key     — 查询分享（公开，无需认证）
 */
import { Hono } from 'hono'
import { db as defaultDb } from '../db'
import { shares } from '../db/schema'
import { eq } from 'drizzle-orm'

type AuthMiddleware = (c: import('hono').Context, next: import('hono').Next) => Promise<Response | void>

interface ShareRouteDeps {
  db?: typeof defaultDb
  auth?: AuthMiddleware
}

type AuthVariables = {
  Variables: {
    userId: string
  }
}

export function createShareRoutes(deps: ShareRouteDeps = {}) {
  const db = deps.db ?? defaultDb
  const router = new Hono<AuthVariables>()

  // 创建分享（需认证）— 仅对 POST / 应用 auth
  if (deps.auth) {
    router.post('/', deps.auth, async (c) => {
      const userId = c.get('userId') as string | undefined
      if (!userId) {
        return c.json({ error: '未认证' }, 401)
      }

      const body = await c.req.json()
      const nodes = body.nodes
      if (!Array.isArray(nodes) || nodes.length === 0) {
        return c.json({ error: '缺少 nodes 数组' }, 400)
      }

      // 校验每个节点至少有 type 字段
      for (const node of nodes) {
        if (!node || typeof node !== 'object' || typeof node.type !== 'string') {
          return c.json({ error: '节点数据格式错误，每个节点必须包含 type 字段' }, 400)
        }
      }

      const shareKey = Array.from(
        crypto.getRandomValues(new Uint8Array(4)),
        (b) => b.toString(16).padStart(2, '0'),
      ).join('')

      const id = crypto.randomUUID()
      try {
        db.insert(shares).values({
          id,
          shareKey,
          userId,
          nodesSnapshot: JSON.stringify(nodes),
        }).returning().get()
      } catch (err: unknown) {
        // shareKey 碰撞（极低概率），重试一次
        if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
          const retryKey = Array.from(
            crypto.getRandomValues(new Uint8Array(4)),
            (b) => b.toString(16).padStart(2, '0'),
          ).join('')
          db.insert(shares).values({
            id,
            shareKey: retryKey,
            userId,
            nodesSnapshot: JSON.stringify(nodes),
          }).returning().get()
          return c.json({ shareKey: retryKey }, 201)
        }
        throw err
      }

      return c.json({ shareKey }, 201)
    })
  } else {
    // 无 auth 中间件时（测试环境），直接返回 401
    router.post('/', async (c) => {
      return c.json({ error: '未认证' }, 401)
    })
  }

  // 查询分享（公开，无需认证）
  router.get('/:key', (c) => {
    const key = c.req.param('key')
    if (!key || key.length > 16) {
      return c.json({ error: '无效的分享密钥' }, 400)
    }

    const row = db.select().from(shares).where(eq(shares.shareKey, key)).get()
    if (!row) {
      return c.json({ error: '分享不存在' }, 404)
    }

    let nodes: unknown[]
    try {
      nodes = JSON.parse(row.nodesSnapshot)
    } catch {
      return c.json({ error: '分享数据损坏' }, 500)
    }

    return c.json({ nodes, createdAt: row.createdAt })
  })

  return router
}
