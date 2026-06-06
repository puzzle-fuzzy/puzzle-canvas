/**
 * 节点路由模块
 *
 * 提供画布节点的完整 CRUD 操作：
 *   GET    /         — 获取所有节点
 *   POST   /         — 创建节点
 *   PATCH  /:id      — 更新节点
 *   DELETE /:id      — 删除节点
 *
 * 通过 createNodeRoutes() 返回类型化的 Hono 子路由，
 * 在 server/index.ts 中以 app.route('/api/nodes', ...) 挂载。
 */
import { Hono } from 'hono'
import { db as defaultDb } from '../db'
import { nodes } from '../db/schema'
import { eq } from 'drizzle-orm'

/** 合法的节点类型，对应前端的 nodeTypes 注册表 */
const VALID_NODE_TYPES = ['urlNode', 'imageNode', 'videoNode', 'docNode']

/** 认证中间件类型 */
type AuthMiddleware = (c: import('hono').Context, next: import('hono').Next) => Promise<Response | void>

/** 路由依赖注入接口（方便测试时替换数据库实例） */
interface NodeRouteDeps {
  db?: typeof defaultDb
  auth?: AuthMiddleware
}

/** 认证中间件写入的上下文变量类型 */
type AuthVariables = {
  Variables: {
    userId: string
  }
}

export function createNodeRoutes(deps: NodeRouteDeps = {}) {
  const db = deps.db ?? defaultDb
  const router = new Hono<AuthVariables>()

  // 应用认证中间件（如果提供）
  if (deps.auth) {
    router.use('*', deps.auth)
  }

  return router
    // 获取当前用户的节点
    .get('/', (c) => {
      const userId = c.get('userId') as string | undefined
      // 有认证时只返回当前用户的节点，否则返回全部（兼容旧测试）
      const allNodes = userId
        ? db.select().from(nodes).where(eq(nodes.userId, userId)).all()
        : db.select().from(nodes).all()
      return c.json(allNodes)
    })

    // 创建节点
    .post('/', async (c) => {
      const body = await c.req.json()

      // 校验必填字段
      if (!body.id || !body.type || body.positionX == null || body.positionY == null) {
        return c.json({ error: '缺少必要字段 (id, type, positionX, positionY)' }, 400)
      }

      // 校验节点类型
      if (!VALID_NODE_TYPES.includes(body.type)) {
        return c.json({ error: `无效的节点类型，允许: ${VALID_NODE_TYPES.join(', ')}` }, 400)
      }

      // 校验位置值为有效数字
      if (typeof body.positionX !== 'number' || typeof body.positionY !== 'number'
        || isNaN(body.positionX) || isNaN(body.positionY)) {
        return c.json({ error: 'positionX 和 positionY 必须为有效数字' }, 400)
      }

      // 插入数据库，未提供的可选字段默认为 null
      // userId 优先从认证中间件获取，兼容无认证的旧测试
      const userId = (c.get('userId') as string | undefined) ?? body.userId ?? 'temp'
      const result = db.insert(nodes).values({
        id: body.id,
        type: body.type,
        positionX: body.positionX,
        positionY: body.positionY,
        userId,
        url: body.url ?? null,
        title: body.title ?? null,
        description: body.description ?? null,
        image: body.image ?? null,
        favicon: body.favicon ?? null,
        src: body.src ?? null,
        fileName: body.fileName ?? null,
        fileSize: body.fileSize ?? null,
      }).returning().get()

      return c.json(result, 201)
    })

    // 更新节点（部分更新，仅允许修改以下字段）
    .patch('/:id', async (c) => {
      const id = c.req.param('id')
      const body = await c.req.json()

      // 认证用户归属校验
      const authUserId = c.get('userId') as string | undefined
      if (authUserId) {
        const existing = db.select({ userId: nodes.userId }).from(nodes).where(eq(nodes.id, id)).get()
        if (existing && existing.userId !== authUserId) {
          return c.json({ error: '无权操作此节点' }, 403)
        }
      }

      // 白名单过滤：只接受允许更新的字段
      const allowedFields = ['positionX', 'positionY', 'title', 'description', 'image', 'favicon', 'src', 'fileName', 'fileSize']
      const updates: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (field in body) {
          updates[field] = body[field]
        }
      }

      if (Object.keys(updates).length === 0) {
        return c.json({ error: '没有可更新的字段' }, 400)
      }

      // 校验数字字段的类型
      if ('positionX' in updates && (typeof updates.positionX !== 'number' || isNaN(updates.positionX as number))) {
        return c.json({ error: 'positionX 必须为有效数字' }, 400)
      }
      if ('positionY' in updates && (typeof updates.positionY !== 'number' || isNaN(updates.positionY as number))) {
        return c.json({ error: 'positionY 必须为有效数字' }, 400)
      }
      if ('fileSize' in updates && (typeof updates.fileSize !== 'number' || isNaN(updates.fileSize as number))) {
        return c.json({ error: 'fileSize 必须为有效数字' }, 400)
      }

      // 校验字符串字段的类型
      if ('title' in updates && typeof updates.title !== 'string') {
        return c.json({ error: 'title 必须为字符串' }, 400)
      }
      if ('description' in updates && typeof updates.description !== 'string') {
        return c.json({ error: 'description 必须为字符串' }, 400)
      }

      const result = db.update(nodes).set(updates).where(eq(nodes.id, id)).returning().get()
      if (!result) {
        return c.json({ error: '节点不存在' }, 404)
      }

      return c.json(result)
    })

    // 删除节点
    .delete('/:id', (c) => {
      const id = c.req.param('id')

      // 认证用户归属校验
      const authUserId = c.get('userId') as string | undefined
      if (authUserId) {
        const existing = db.select({ userId: nodes.userId }).from(nodes).where(eq(nodes.id, id)).get()
        if (existing && existing.userId !== authUserId) {
          return c.json({ error: '无权操作此节点' }, 403)
        }
      }

      const result = db.delete(nodes).where(eq(nodes.id, id)).returning().get()
      if (!result) {
        return c.json({ error: '节点不存在' }, 404)
      }
      return c.body(null, 204)
    })
}
