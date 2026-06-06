import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  schema: './server/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'puzzle-canvas.db',
  },
})
