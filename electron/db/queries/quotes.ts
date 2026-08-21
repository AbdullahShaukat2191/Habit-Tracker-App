import { eq, and } from 'drizzle-orm'
import { getDb } from '../client'
import { quotes } from '../schema'
import type { Quote, CreateQuoteInput, UpdateQuoteInput } from '../../../shared/types'
import { randomUUID } from 'crypto'

function rowToQuote(row: typeof quotes.$inferSelect): Quote {
  return {
    id: row.id,
    author: row.author,
    text: row.text,
    bundled: Boolean(row.bundled),
    hidden: Boolean(row.hidden),
    addedAt: row.addedAt,
  }
}

export function listQuotes(): Quote[] {
  const db = getDb()
  return db.select().from(quotes).all().map(rowToQuote)
}

export function getRandomVisibleQuote(): Quote | null {
  const db = getDb()
  const visible = db
    .select()
    .from(quotes)
    .where(eq(quotes.hidden, false))
    .all()
    .map(rowToQuote)
  if (visible.length === 0) return null
  return visible[Math.floor(Math.random() * visible.length)]
}

export function createQuote(input: CreateQuoteInput): Quote {
  const db = getDb()
  const row = {
    id: randomUUID(),
    author: input.author,
    text: input.text,
    bundled: false,
    hidden: false,
    addedAt: Date.now(),
  }
  db.insert(quotes).values(row).run()
  return rowToQuote(db.select().from(quotes).where(eq(quotes.id, row.id)).get()!)
}

export function updateQuote(id: string, input: UpdateQuoteInput): Quote {
  const db = getDb()
  const updates: Partial<typeof quotes.$inferInsert> = {}
  if (input.text !== undefined) updates.text = input.text
  if (input.author !== undefined) updates.author = input.author
  db.update(quotes).set(updates).where(eq(quotes.id, id)).run()
  return rowToQuote(db.select().from(quotes).where(eq(quotes.id, id)).get()!)
}

export function deleteQuote(id: string): void {
  const db = getDb()
  // Only allow deleting user-added quotes (bundled = 0)
  db.delete(quotes).where(and(eq(quotes.id, id), eq(quotes.bundled, false))).run()
}

export function toggleQuoteHidden(id: string): void {
  const db = getDb()
  const q = db.select().from(quotes).where(eq(quotes.id, id)).get()
  if (!q) return
  db.update(quotes).set({ hidden: !q.hidden }).where(eq(quotes.id, id)).run()
}
