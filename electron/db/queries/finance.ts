import { eq, asc } from 'drizzle-orm'
import { getDb } from '../client'
import { financeCategories, financeTransactions, financeSavingsEntries } from '../schema'
import type {
  FinanceCategory, CreateFinanceCategoryInput, UpdateFinanceCategoryInput,
  FinanceTransaction, CreateFinanceTransactionInput, UpdateFinanceTransactionInput,
  FinanceSavingsEntry, CreateFinanceSavingsEntryInput,
} from '../../../shared/types'
import { randomUUID } from 'crypto'

function rowToCategory(row: typeof financeCategories.$inferSelect): FinanceCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt ?? null,
  }
}

function rowToTransaction(row: typeof financeTransactions.$inferSelect): FinanceTransaction {
  return {
    id: row.id,
    title: row.title,
    amount: row.amount,
    categoryId: row.categoryId,
    date: row.date,
    createdAt: row.createdAt,
  }
}

function rowToSavingsEntry(row: typeof financeSavingsEntries.$inferSelect): FinanceSavingsEntry {
  return {
    id: row.id,
    amount: row.amount,
    note: row.note,
    date: row.date,
    createdAt: row.createdAt,
  }
}

// ─── Categories ───────────────────────────────────────────────────────────────

export function listFinanceCategories(): FinanceCategory[] {
  const db = getDb()
  // Returns ALL categories (active + archived) so historical transactions can
  // still resolve a name/color for a category that's since been archived.
  return db.select().from(financeCategories).orderBy(asc(financeCategories.sortOrder)).all().map(rowToCategory)
}

export function createFinanceCategory(input: CreateFinanceCategoryInput): FinanceCategory {
  const db = getDb()
  const existing = db.select().from(financeCategories).all()
  const maxOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), -1)
  const row = {
    id: randomUUID(),
    name: input.name,
    color: input.color,
    sortOrder: maxOrder + 1,
    createdAt: Date.now(),
    archivedAt: null,
  }
  db.insert(financeCategories).values(row).run()
  return rowToCategory(db.select().from(financeCategories).where(eq(financeCategories.id, row.id)).get()!)
}

export function updateFinanceCategory(id: string, input: UpdateFinanceCategoryInput): FinanceCategory {
  const db = getDb()
  const updates: Partial<typeof financeCategories.$inferInsert> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.color !== undefined) updates.color = input.color
  db.update(financeCategories).set(updates).where(eq(financeCategories.id, id)).run()
  return rowToCategory(db.select().from(financeCategories).where(eq(financeCategories.id, id)).get()!)
}

export function archiveFinanceCategory(id: string): void {
  const db = getDb()
  db.update(financeCategories).set({ archivedAt: Date.now() }).where(eq(financeCategories.id, id)).run()
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function listFinanceTransactions(): FinanceTransaction[] {
  const db = getDb()
  return db.select().from(financeTransactions).orderBy(asc(financeTransactions.date)).all().map(rowToTransaction)
}

export function createFinanceTransaction(input: CreateFinanceTransactionInput): FinanceTransaction {
  const db = getDb()
  const row = {
    id: randomUUID(),
    title: input.title,
    amount: input.amount,
    categoryId: input.categoryId ?? null,
    date: input.date,
    createdAt: Date.now(),
  }
  db.insert(financeTransactions).values(row).run()
  return rowToTransaction(db.select().from(financeTransactions).where(eq(financeTransactions.id, row.id)).get()!)
}

export function updateFinanceTransaction(id: string, input: UpdateFinanceTransactionInput): FinanceTransaction {
  const db = getDb()
  const updates: Partial<typeof financeTransactions.$inferInsert> = {}
  if (input.title !== undefined) updates.title = input.title
  if (input.amount !== undefined) updates.amount = input.amount
  if (input.categoryId !== undefined) updates.categoryId = input.categoryId
  if (input.date !== undefined) updates.date = input.date
  db.update(financeTransactions).set(updates).where(eq(financeTransactions.id, id)).run()
  return rowToTransaction(db.select().from(financeTransactions).where(eq(financeTransactions.id, id)).get()!)
}

export function deleteFinanceTransaction(id: string): void {
  const db = getDb()
  db.delete(financeTransactions).where(eq(financeTransactions.id, id)).run()
}

// ─── Savings entries ──────────────────────────────────────────────────────────

export function listFinanceSavingsEntries(): FinanceSavingsEntry[] {
  const db = getDb()
  return db.select().from(financeSavingsEntries).orderBy(asc(financeSavingsEntries.date)).all().map(rowToSavingsEntry)
}

export function createFinanceSavingsEntry(input: CreateFinanceSavingsEntryInput): FinanceSavingsEntry {
  const db = getDb()
  const row = {
    id: randomUUID(),
    amount: input.amount,
    note: input.note ?? null,
    date: input.date,
    createdAt: Date.now(),
  }
  db.insert(financeSavingsEntries).values(row).run()
  return rowToSavingsEntry(db.select().from(financeSavingsEntries).where(eq(financeSavingsEntries.id, row.id)).get()!)
}

export function deleteFinanceSavingsEntry(id: string): void {
  const db = getDb()
  db.delete(financeSavingsEntries).where(eq(financeSavingsEntries.id, id)).run()
}
