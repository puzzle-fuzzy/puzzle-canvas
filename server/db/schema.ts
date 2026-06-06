import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const nodes = sqliteTable('nodes', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['urlNode', 'imageNode', 'videoNode', 'docNode'] }).notNull(),
  positionX: real('position_x').notNull(),
  positionY: real('position_y').notNull(),

  // urlNode 字段
  url: text('url'),
  title: text('title'),
  description: text('description'),
  image: text('image'),
  favicon: text('favicon'),

  // imageNode / videoNode / docNode 字段
  src: text('src'),
  fileName: text('fileName'),
  fileSize: integer('file_size'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})
