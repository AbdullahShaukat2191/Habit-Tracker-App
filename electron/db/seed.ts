import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

interface QuoteJson {
  id: string
  author: string
  text: string
  source: string
  bundled: boolean
}

// Seeds bundled quotes from data/quotes.json on first run.
// Skips if a quote with the same ID already exists.
export function seedQuotes(db: BetterSQLite3Database<typeof schema>, appPath: string) {
  const quotesPath = path.join(appPath, 'data', 'quotes.json')

  if (!fs.existsSync(quotesPath)) {
    console.warn('quotes.json not found at', quotesPath)
    return
  }

  const rawQuotes: QuoteJson[] = JSON.parse(fs.readFileSync(quotesPath, 'utf-8'))
  const now = Date.now()

  for (const q of rawQuotes) {
    const existing = db.select().from(schema.quotes).where(eq(schema.quotes.id, q.id)).get()
    if (existing) continue

    db.insert(schema.quotes).values({
      id: q.id,
      author: q.author,
      text: q.text,
      bundled: true,
      hidden: false,
      addedAt: now,
    }).run()
  }
}

// Seeds default settings if they don't already exist.
export function seedDefaultSettings(db: BetterSQLite3Database<typeof schema>) {
  const defaults: Array<{ key: string; value: string }> = [
    { key: 'notifications_enabled', value: 'true' },
    { key: 'notify_habits', value: 'true' },
    { key: 'notify_tasks', value: 'true' },
    { key: 'notify_goals', value: 'true' },
    { key: 'notify_active_start', value: '09:00' },
    { key: 'notify_active_end', value: '22:00' },
    { key: 'notify_min_hours', value: '1' },
    { key: 'notify_max_hours', value: '2' },
    { key: 'launch_on_startup', value: 'false' },
    { key: 'start_minimized', value: 'false' },
    { key: 'close_to_tray', value: 'true' },
  ]

  for (const s of defaults) {
    const existing = db.select().from(schema.settings).where(eq(schema.settings.key, s.key)).get()
    if (!existing) {
      db.insert(schema.settings).values(s).run()
    }
  }
}

// Seeds default page/tab → quote assignments (the quotes that used to be
// hardcoded per page) so existing display behavior is unchanged until
// someone picks a different quote via the hover-to-edit picker.
export function seedQuoteAssignments(db: BetterSQLite3Database<typeof schema>) {
  const defaults: Array<{ pageId: string; tabId: string; quoteId: string }> = [
    { pageId: 'tasks', tabId: 'today', quoteId: 'h023' },
    { pageId: 'tasks', tabId: 'optional', quoteId: 'h022' },
    { pageId: 'tasks', tabId: 'completed', quoteId: 'g007' },
    { pageId: 'wishlist', tabId: '', quoteId: 'h012' },
    { pageId: 'goals', tabId: '', quoteId: 'g011' },
    { pageId: 'finance', tabId: '', quoteId: 'b001' },
    { pageId: 'projects', tabId: '', quoteId: 'h024' },
  ]

  for (const a of defaults) {
    const existing = db
      .select()
      .from(schema.quoteAssignments)
      .where(and(eq(schema.quoteAssignments.pageId, a.pageId), eq(schema.quoteAssignments.tabId, a.tabId)))
      .get()
    if (!existing) {
      db.insert(schema.quoteAssignments).values(a).run()
    }
  }
}
