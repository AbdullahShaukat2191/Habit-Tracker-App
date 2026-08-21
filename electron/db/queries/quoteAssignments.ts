import { and, eq } from 'drizzle-orm'
import { getDb } from '../client'
import { quoteAssignments } from '../schema'
import type { QuoteAssignments } from '../../../shared/types'

function assignmentKey(pageId: string, tabId: string): string {
  return `${pageId}:${tabId}`
}

export function getAllQuoteAssignments(): QuoteAssignments {
  const db = getDb()
  const rows = db.select().from(quoteAssignments).all()
  return Object.fromEntries(rows.map((r) => [assignmentKey(r.pageId, r.tabId), r.quoteId]))
}

export function setQuoteAssignment(pageId: string, tabId: string, quoteId: string): void {
  const db = getDb()
  const existing = db
    .select()
    .from(quoteAssignments)
    .where(and(eq(quoteAssignments.pageId, pageId), eq(quoteAssignments.tabId, tabId)))
    .get()

  if (existing) {
    db.update(quoteAssignments)
      .set({ quoteId })
      .where(and(eq(quoteAssignments.pageId, pageId), eq(quoteAssignments.tabId, tabId)))
      .run()
  } else {
    db.insert(quoteAssignments).values({ pageId, tabId, quoteId }).run()
  }
}
