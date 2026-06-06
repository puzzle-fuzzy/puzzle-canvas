import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const nodes = sqliteTable('nodes', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['urlNode', 'imageNode', 'videoNode'] }).notNull(),
  positionX: real('position_x').notNull(),
  positionY: real('position_y').notNull(),

  // urlNode 字段
  url: text('url'),
  title: text('title'),
  description: text('description'),
  image: text('image'),
  favicon: text('favicon'),

  // imageNode / videoNode 字段
  src: text('src'),
  fileName: text('fileName'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})
