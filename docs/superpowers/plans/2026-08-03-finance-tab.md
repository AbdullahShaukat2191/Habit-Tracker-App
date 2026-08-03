# Finance Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-level "Finance" tab: monthly budget, a Rupee spending log with custom color-tagged categories, a manual savings ledger, weekly/monthly totals, and three charts (spending trend, this-week, category donut).

**Architecture:** Follows this codebase's existing Payments feature pattern end-to-end: Drizzle schema + raw DDL in `migrate.ts` → query module in `electron/db/queries/` → IPC handlers → preload/electron.d.ts/ipc.ts wrappers → a zustand store that loads everything up front → presentational React components with inline styles reading CSS custom properties (`var(--accent)` etc.). Date-range math lives in a new pure, unit-tested `shared/financeLogic.ts`, mirroring `shared/habitLogic.ts`.

**Tech Stack:** Next.js (renderer) + Electron (main) + better-sqlite3/drizzle-orm + zustand + date-fns + framer-motion + lucide-react. No charting library — hand-rolled inline SVG, matching the existing `PaymentDonut` precedent.

## Global Constraints

- Currency formatting: `Rs. ${amount.toLocaleString()}` everywhere (mirrors the existing `${amount.toLocaleString()}` dollar convention in Payments).
- Category/preset colors: reuse the exact same 8-color array already used by Projects/Payment Projects: `['#E879B9', '#A78BFA', '#34D399', '#60A5FA', '#FBBF24', '#F87171', '#86EFAC', '#818CF8']`.
- No new settings-page UI for the monthly budget — it's edited directly on the Finance dashboard via the existing generic `useSettingsStore().get/set(key, value)` mechanism, key `SETTING_KEYS.MONTHLY_BUDGET`.
- Delete/Edit actions on rows use explicit icon buttons (`Pencil`/`Trash2` from `lucide-react`), never click-to-edit — this codebase corrected away from click-to-edit once already (see Payments spec "Revision 2").
- All new IDs are `randomUUID()` strings; all timestamps are `Date.now()` epoch-ms integers; dates are `'YYYY-MM-DD'` strings — matching every existing table.
- No income tracking, no multi-account, no recurring transactions, no savings goals — explicitly out of scope per the approved design.

---

### Task 1: Schema, shared types, and pure finance-calculation logic (TDD)

**Files:**
- Modify: `electron/db/schema.ts`
- Modify: `electron/db/migrate.ts`
- Modify: `shared/types.ts`
- Create: `shared/financeLogic.ts`
- Test: `shared/__tests__/financeLogic.test.ts`

**Interfaces:**
- Produces: `FinanceCategory`, `FinanceTransaction`, `FinanceSavingsEntry`, `CreateFinanceCategoryInput`, `UpdateFinanceCategoryInput`, `CreateFinanceTransactionInput`, `UpdateFinanceTransactionInput`, `CreateFinanceSavingsEntryInput` (all in `shared/types.ts`); `SETTING_KEYS.MONTHLY_BUDGET`.
- Produces (from `shared/financeLogic.ts`): `getMonthRange(month: string): { start: string; end: string }`, `sumInRange(transactions: FinanceTransaction[], start: string, end: string): number`, `sumForMonth(transactions: FinanceTransaction[], month: string): number`, `getWeekRange(today: string): { start: string; end: string }`, `sumForWeek(transactions: FinanceTransaction[], today: string): number`, `getWeekdayTotals(transactions: FinanceTransaction[], today: string): number[]` (7 entries, Mon..Sun), `getMonthlyTrend(transactions: FinanceTransaction[], month: string, count: number): Array<{ month: string; total: number }>` (oldest-first, inclusive of `month`), `CategoryBreakdownEntry` type + `getCategoryBreakdown(transactions: FinanceTransaction[], categories: FinanceCategory[], month: string): CategoryBreakdownEntry[]` (sorted descending by total, uncategorized last).

- [ ] **Step 1: Write the failing test**

Create `shared/__tests__/financeLogic.test.ts`:

```ts
import {
  sumInRange,
  getMonthRange,
  sumForMonth,
  getWeekRange,
  sumForWeek,
  getWeekdayTotals,
  getMonthlyTrend,
  getCategoryBreakdown,
} from '../financeLogic'
import type { FinanceTransaction, FinanceCategory } from '../types'

function tx(id: string, amount: number, date: string, categoryId: string | null = null): FinanceTransaction {
  return { id, amount, date, categoryId, title: 'test', createdAt: 0 }
}

describe('getMonthRange', () => {
  test('returns first/last day for a 31-day month', () => {
    expect(getMonthRange('2026-07')).toEqual({ start: '2026-07-01', end: '2026-07-31' })
  })
  test('returns first/last day for February in a non-leap year', () => {
    expect(getMonthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })
})

describe('sumInRange', () => {
  test('sums only transactions within the inclusive range', () => {
    const txs = [tx('1', 100, '2026-07-30'), tx('2', 50, '2026-08-01'), tx('3', 25, '2026-08-02')]
    expect(sumInRange(txs, '2026-08-01', '2026-08-02')).toBe(75)
  })
  test('returns 0 for an empty list', () => {
    expect(sumInRange([], '2026-08-01', '2026-08-31')).toBe(0)
  })
})

describe('sumForMonth', () => {
  test('sums all transactions in the given month only', () => {
    const txs = [tx('1', 100, '2026-07-31'), tx('2', 200, '2026-08-01'), tx('3', 300, '2026-08-31'), tx('4', 400, '2026-09-01')]
    expect(sumForMonth(txs, '2026-08')).toBe(500)
  })
})

describe('getWeekRange', () => {
  test('returns the Monday-Sunday week containing the given date', () => {
    // 2026-08-03 is a Monday
    expect(getWeekRange('2026-08-03')).toEqual({ start: '2026-08-03', end: '2026-08-09' })
    // 2026-08-09 is a Sunday, same week
    expect(getWeekRange('2026-08-09')).toEqual({ start: '2026-08-03', end: '2026-08-09' })
  })
})

describe('sumForWeek', () => {
  test('sums only transactions within the week containing the given date', () => {
    const txs = [tx('1', 100, '2026-08-02'), tx('2', 50, '2026-08-03'), tx('3', 25, '2026-08-09'), tx('4', 10, '2026-08-10')]
    expect(sumForWeek(txs, '2026-08-05')).toBe(75)
  })
})

describe('getWeekdayTotals', () => {
  test('returns 7 totals, Monday through Sunday, in order', () => {
    const txs = [tx('1', 100, '2026-08-03'), tx('2', 50, '2026-08-03'), tx('3', 25, '2026-08-09')]
    const totals = getWeekdayTotals(txs, '2026-08-05')
    expect(totals).toEqual([150, 0, 0, 0, 0, 0, 25])
  })
})

describe('getMonthlyTrend', () => {
  test('returns the last N months oldest-first, ending at the given month', () => {
    const txs = [tx('1', 100, '2026-06-15'), tx('2', 200, '2026-07-15'), tx('3', 300, '2026-08-15')]
    const trend = getMonthlyTrend(txs, '2026-08', 3)
    expect(trend).toEqual([
      { month: '2026-06', total: 100 },
      { month: '2026-07', total: 200 },
      { month: '2026-08', total: 300 },
    ])
  })
  test('rolls back across a year boundary', () => {
    const trend = getMonthlyTrend([], '2026-01', 3)
    expect(trend.map((t) => t.month)).toEqual(['2025-11', '2025-12', '2026-01'])
  })
})

describe('getCategoryBreakdown', () => {
  const categories: FinanceCategory[] = [
    { id: 'c1', name: 'Food', color: '#E879B9', sortOrder: 0, createdAt: 0, archivedAt: null },
    { id: 'c2', name: 'Transport', color: '#60A5FA', sortOrder: 1, createdAt: 0, archivedAt: null },
  ]

  test('groups by category, sorted descending by total, within the given month', () => {
    const txs = [
      tx('1', 100, '2026-08-01', 'c1'),
      tx('2', 50, '2026-08-02', 'c2'),
      tx('3', 200, '2026-08-03', 'c1'),
      tx('4', 999, '2026-07-31', 'c1'), // outside the month, excluded
    ]
    const result = getCategoryBreakdown(txs, categories, '2026-08')
    expect(result).toEqual([
      { categoryId: 'c1', name: 'Food', color: '#E879B9', total: 300 },
      { categoryId: 'c2', name: 'Transport', color: '#60A5FA', total: 50 },
    ])
  })

  test('groups uncategorized transactions last under a fixed label', () => {
    const txs = [tx('1', 100, '2026-08-01', 'c1'), tx('2', 500, '2026-08-02', null)]
    const result = getCategoryBreakdown(txs, categories, '2026-08')
    expect(result).toEqual([
      { categoryId: 'c1', name: 'Food', color: '#E879B9', total: 100 },
      { categoryId: null, name: 'Uncategorized', color: 'var(--text-tertiary)', total: 500 },
    ])
  })

  test('returns an empty array when there are no transactions in the month', () => {
    expect(getCategoryBreakdown([], categories, '2026-08')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest shared/__tests__/financeLogic.test.ts`
Expected: FAIL — `Cannot find module '../financeLogic'`

- [ ] **Step 3: Implement `shared/financeLogic.ts`**

```ts
// Pure finance calculation logic — used by both Electron main process and Next.js renderer.
// No Node.js or Electron imports allowed here.

import type { FinanceTransaction, FinanceCategory } from './types'
import { getDaysInMonth, startOfWeek, endOfWeek, addDays, format } from 'date-fns'

export function getMonthRange(month: string): { start: string; end: string } {
  const [year, monthNum] = month.split('-').map(Number)
  const days = getDaysInMonth(new Date(year, monthNum - 1))
  return { start: `${month}-01`, end: `${month}-${String(days).padStart(2, '0')}` }
}

export function sumInRange(transactions: FinanceTransaction[], start: string, end: string): number {
  return transactions
    .filter((t) => t.date >= start && t.date <= end)
    .reduce((sum, t) => sum + t.amount, 0)
}

export function sumForMonth(transactions: FinanceTransaction[], month: string): number {
  const { start, end } = getMonthRange(month)
  return sumInRange(transactions, start, end)
}

export function getWeekRange(today: string): { start: string; end: string } {
  const d = new Date(today + 'T12:00:00')
  const weekStart = startOfWeek(d, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(d, { weekStartsOn: 1 })
  return { start: format(weekStart, 'yyyy-MM-dd'), end: format(weekEnd, 'yyyy-MM-dd') }
}

export function sumForWeek(transactions: FinanceTransaction[], today: string): number {
  const { start, end } = getWeekRange(today)
  return sumInRange(transactions, start, end)
}

// Per-day totals Monday through Sunday for the week containing `today`
export function getWeekdayTotals(transactions: FinanceTransaction[], today: string): number[] {
  const d = new Date(today + 'T12:00:00')
  const weekStart = startOfWeek(d, { weekStartsOn: 1 })
  const totals: number[] = []
  for (let i = 0; i < 7; i++) {
    const dateStr = format(addDays(weekStart, i), 'yyyy-MM-dd')
    totals.push(transactions.filter((t) => t.date === dateStr).reduce((sum, t) => sum + t.amount, 0))
  }
  return totals
}

// Last `count` months' totals ending at `month` (inclusive), oldest first
export function getMonthlyTrend(
  transactions: FinanceTransaction[],
  month: string,
  count: number
): Array<{ month: string; total: number }> {
  const [year, monthNum] = month.split('-').map(Number)
  const result: Array<{ month: string; total: number }> = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(year, monthNum - 1 - i, 1)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push({ month: m, total: sumForMonth(transactions, m) })
  }
  return result
}

export interface CategoryBreakdownEntry {
  categoryId: string | null
  name: string
  color: string
  total: number
}

// Category breakdown for a given month, sorted descending by total; uncategorized last if present
export function getCategoryBreakdown(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[],
  month: string
): CategoryBreakdownEntry[] {
  const { start, end } = getMonthRange(month)
  const inMonth = transactions.filter((t) => t.date >= start && t.date <= end)
  const categoryMap = new Map(categories.map((c) => [c.id, c]))
  const totals = new Map<string | null, number>()
  for (const t of inMonth) {
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount)
  }

  const entries: CategoryBreakdownEntry[] = []
  for (const [categoryId, total] of totals) {
    if (categoryId === null) continue
    const cat = categoryMap.get(categoryId)
    if (!cat) continue
    entries.push({ categoryId, name: cat.name, color: cat.color, total })
  }
  entries.sort((a, b) => b.total - a.total)

  const uncategorized = totals.get(null)
  if (uncategorized) {
    entries.push({ categoryId: null, name: 'Uncategorized', color: 'var(--text-tertiary)', total: uncategorized })
  }
  return entries
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest shared/__tests__/financeLogic.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Add the schema tables**

In `electron/db/schema.ts`, add after the `wishlistItems` export:

```ts
export const financeCategories = sqliteTable('finance_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  archivedAt: integer('archived_at'),
})

export const financeTransactions = sqliteTable('finance_transactions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  amount: real('amount').notNull(),
  categoryId: text('category_id').references(() => financeCategories.id),
  date: text('date').notNull(), // 'YYYY-MM-DD'
  createdAt: integer('created_at').notNull(),
})

export const financeSavingsEntries = sqliteTable('finance_savings_entries', {
  id: text('id').primaryKey(),
  amount: real('amount').notNull(),
  note: text('note'),
  date: text('date').notNull(), // 'YYYY-MM-DD'
  createdAt: integer('created_at').notNull(),
})
```

- [ ] **Step 6: Add the raw DDL**

In `electron/db/migrate.ts`, add at the end of `runMigrations`, before the closing brace:

```ts
  // Finance: categories, transactions, and the manual savings ledger
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS finance_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      archived_at INTEGER
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id TEXT,
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (category_id) REFERENCES finance_categories(id)
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS finance_savings_entries (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      note TEXT,
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)
```

- [ ] **Step 7: Add the shared types**

In `shared/types.ts`, add after the `WishlistItem`/`CreateWishlistInput`/`UpdateWishlistInput` block (or any convenient spot before `SettingsMap`):

```ts
// --- Finance ---

export interface FinanceCategory {
  id: string
  name: string
  color: string
  sortOrder: number
  createdAt: number
  archivedAt: number | null
}

export interface FinanceTransaction {
  id: string
  title: string
  amount: number
  categoryId: string | null
  date: string // 'YYYY-MM-DD'
  createdAt: number
}

export interface FinanceSavingsEntry {
  id: string
  amount: number
  note: string | null
  date: string // 'YYYY-MM-DD'
  createdAt: number
}

export interface CreateFinanceCategoryInput {
  name: string
  color: string
}

export interface UpdateFinanceCategoryInput {
  name?: string
  color?: string
}

export interface CreateFinanceTransactionInput {
  title: string
  amount: number
  categoryId?: string | null
  date: string
}

export interface UpdateFinanceTransactionInput {
  title?: string
  amount?: number
  categoryId?: string | null
  date?: string
}

export interface CreateFinanceSavingsEntryInput {
  amount: number
  note?: string
  date: string
}
```

Then add one line inside the existing `SETTING_KEYS` object (anywhere in the list):

```ts
  MONTHLY_BUDGET: 'monthly_budget',
```

- [ ] **Step 8: Run the full test suite and both typechecks**

Run: `npx jest`
Expected: all suites pass (existing 24 + new 12 = 36).

Run: `npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.electron.json`
Expected: no output (clean).

- [ ] **Step 9: Commit**

```bash
git add electron/db/schema.ts electron/db/migrate.ts shared/types.ts shared/financeLogic.ts shared/__tests__/financeLogic.test.ts
git commit -m "Add finance schema, types, and pure calculation logic"
```

---

### Task 2: Electron query layer + IPC wiring

**Files:**
- Create: `electron/db/queries/finance.ts`
- Modify: `electron/ipc/handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/electron.d.ts`
- Modify: `src/lib/ipc.ts`

**Interfaces:**
- Consumes: `financeCategories`, `financeTransactions`, `financeSavingsEntries` (Task 1, `electron/db/schema.ts`); `FinanceCategory`, `FinanceTransaction`, `FinanceSavingsEntry` + `Create*`/`Update*Input` types (Task 1, `shared/types.ts`).
- Produces: query functions `listFinanceCategories()`, `createFinanceCategory(input)`, `updateFinanceCategory(id, input)`, `archiveFinanceCategory(id)`, `listFinanceTransactions()`, `createFinanceTransaction(input)`, `updateFinanceTransaction(id, input)`, `deleteFinanceTransaction(id)`, `listFinanceSavingsEntries()`, `createFinanceSavingsEntry(input)`, `deleteFinanceSavingsEntry(id)` — all exposed identically through IPC and `src/lib/ipc.ts` under matching names (e.g. `ipc.listFinanceCategories()`).

This codebase has no existing unit tests for its DB-query/IPC layer (confirmed: `electron/db/queries/payments.ts` has none) — verification for this task is `tsc --noEmit` on both configs, matching established precedent. Do not invent a new testing pattern for this layer.

- [ ] **Step 1: Write the query module**

Create `electron/db/queries/finance.ts`:

```ts
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
```

- [ ] **Step 2: Register IPC handlers**

In `electron/ipc/handlers.ts`, add the import near the other query imports:

```ts
import * as financeQueries from '../db/queries/finance'
```

Then add, inside `registerAllHandlers()` (e.g. after the Payments block):

```ts
  // Finance Categories
  handle('financeCategories:list', () => financeQueries.listFinanceCategories())
  handle('financeCategories:create', (input) => financeQueries.createFinanceCategory(input))
  handle('financeCategories:update', (id, input) => financeQueries.updateFinanceCategory(id, input))
  handle('financeCategories:archive', (id) => financeQueries.archiveFinanceCategory(id))

  // Finance Transactions
  handle('financeTransactions:list', () => financeQueries.listFinanceTransactions())
  handle('financeTransactions:create', (input) => financeQueries.createFinanceTransaction(input))
  handle('financeTransactions:update', (id, input) => financeQueries.updateFinanceTransaction(id, input))
  handle('financeTransactions:delete', (id) => financeQueries.deleteFinanceTransaction(id))

  // Finance Savings
  handle('financeSavings:list', () => financeQueries.listFinanceSavingsEntries())
  handle('financeSavings:create', (input) => financeQueries.createFinanceSavingsEntry(input))
  handle('financeSavings:delete', (id) => financeQueries.deleteFinanceSavingsEntry(id))
```

- [ ] **Step 3: Expose via preload**

In `electron/preload.ts`, add to the type-only import block:

```ts
  FinanceCategory, FinanceTransaction, FinanceSavingsEntry,
  CreateFinanceCategoryInput, UpdateFinanceCategoryInput,
  CreateFinanceTransactionInput, UpdateFinanceTransactionInput,
  CreateFinanceSavingsEntryInput,
```

Then add to the `api` object (e.g. after the Payments block):

```ts
  // --- Finance Categories ---
  listFinanceCategories: (): Promise<FinanceCategory[]> =>
    ipcRenderer.invoke('financeCategories:list'),
  createFinanceCategory: (input: CreateFinanceCategoryInput): Promise<FinanceCategory> =>
    ipcRenderer.invoke('financeCategories:create', input),
  updateFinanceCategory: (id: string, input: UpdateFinanceCategoryInput): Promise<FinanceCategory> =>
    ipcRenderer.invoke('financeCategories:update', id, input),
  archiveFinanceCategory: (id: string): Promise<void> =>
    ipcRenderer.invoke('financeCategories:archive', id),

  // --- Finance Transactions ---
  listFinanceTransactions: (): Promise<FinanceTransaction[]> =>
    ipcRenderer.invoke('financeTransactions:list'),
  createFinanceTransaction: (input: CreateFinanceTransactionInput): Promise<FinanceTransaction> =>
    ipcRenderer.invoke('financeTransactions:create', input),
  updateFinanceTransaction: (id: string, input: UpdateFinanceTransactionInput): Promise<FinanceTransaction> =>
    ipcRenderer.invoke('financeTransactions:update', id, input),
  deleteFinanceTransaction: (id: string): Promise<void> =>
    ipcRenderer.invoke('financeTransactions:delete', id),

  // --- Finance Savings ---
  listFinanceSavingsEntries: (): Promise<FinanceSavingsEntry[]> =>
    ipcRenderer.invoke('financeSavings:list'),
  createFinanceSavingsEntry: (input: CreateFinanceSavingsEntryInput): Promise<FinanceSavingsEntry> =>
    ipcRenderer.invoke('financeSavings:create', input),
  deleteFinanceSavingsEntry: (id: string): Promise<void> =>
    ipcRenderer.invoke('financeSavings:delete', id),
```

- [ ] **Step 4: Add types to `ElectronAPI`**

In `src/types/electron.d.ts`, add matching method signatures to the `ElectronAPI` interface (same shapes as Step 3, without the implementation bodies), e.g.:

```ts
  listFinanceCategories: () => Promise<FinanceCategory[]>
  createFinanceCategory: (input: CreateFinanceCategoryInput) => Promise<FinanceCategory>
  updateFinanceCategory: (id: string, input: UpdateFinanceCategoryInput) => Promise<FinanceCategory>
  archiveFinanceCategory: (id: string) => Promise<void>
  listFinanceTransactions: () => Promise<FinanceTransaction[]>
  createFinanceTransaction: (input: CreateFinanceTransactionInput) => Promise<FinanceTransaction>
  updateFinanceTransaction: (id: string, input: UpdateFinanceTransactionInput) => Promise<FinanceTransaction>
  deleteFinanceTransaction: (id: string) => Promise<void>
  listFinanceSavingsEntries: () => Promise<FinanceSavingsEntry[]>
  createFinanceSavingsEntry: (input: CreateFinanceSavingsEntryInput) => Promise<FinanceSavingsEntry>
  deleteFinanceSavingsEntry: (id: string) => Promise<void>
```

Also replace the top-of-file import block with the same list plus the new Finance types:

```ts
import type {
  Habit, HabitCompletion, Task, Project, Goal, MonthlyReport, Quote,
  WishlistItem,
  PaymentProject, PaymentMilestone, PaymentRecord,
  FinanceCategory, FinanceTransaction, FinanceSavingsEntry,
  CreateHabitInput, UpdateHabitInput,
  CreateTaskInput, UpdateTaskInput,
  CreateProjectInput, UpdateProjectInput,
  CreateGoalInput, UpdateGoalInput,
  CreateQuoteInput, UpdateQuoteInput,
  CreateWishlistInput, UpdateWishlistInput,
  CreatePaymentProjectInput, UpdatePaymentProjectInput,
  CreatePaymentMilestoneInput, UpdatePaymentMilestoneInput,
  CreatePaymentRecordInput,
  CreateFinanceCategoryInput, UpdateFinanceCategoryInput,
  CreateFinanceTransactionInput, UpdateFinanceTransactionInput,
  CreateFinanceSavingsEntryInput,
  SettingsMap, ToggleResult,
} from '../../shared/types'
```

- [ ] **Step 5: Add wrappers in `src/lib/ipc.ts`**

Apply the identical import-block change as Step 4 (`src/lib/ipc.ts`'s top import is line-for-line identical in shape to `electron.d.ts`'s, just consumed by a different file — add the same Finance types in the same positions). Then add:

```ts
// Finance Categories
export const listFinanceCategories = (): Promise<FinanceCategory[]> => api().listFinanceCategories()
export const createFinanceCategory = (input: CreateFinanceCategoryInput): Promise<FinanceCategory> => api().createFinanceCategory(input)
export const updateFinanceCategory = (id: string, input: UpdateFinanceCategoryInput): Promise<FinanceCategory> => api().updateFinanceCategory(id, input)
export const archiveFinanceCategory = (id: string): Promise<void> => api().archiveFinanceCategory(id)

// Finance Transactions
export const listFinanceTransactions = (): Promise<FinanceTransaction[]> => api().listFinanceTransactions()
export const createFinanceTransaction = (input: CreateFinanceTransactionInput): Promise<FinanceTransaction> => api().createFinanceTransaction(input)
export const updateFinanceTransaction = (id: string, input: UpdateFinanceTransactionInput): Promise<FinanceTransaction> => api().updateFinanceTransaction(id, input)
export const deleteFinanceTransaction = (id: string): Promise<void> => api().deleteFinanceTransaction(id)

// Finance Savings
export const listFinanceSavingsEntries = (): Promise<FinanceSavingsEntry[]> => api().listFinanceSavingsEntries()
export const createFinanceSavingsEntry = (input: CreateFinanceSavingsEntryInput): Promise<FinanceSavingsEntry> => api().createFinanceSavingsEntry(input)
export const deleteFinanceSavingsEntry = (id: string): Promise<void> => api().deleteFinanceSavingsEntry(id)
```

- [ ] **Step 6: Verify both typechecks are clean**

Run: `npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.electron.json`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add electron/db/queries/finance.ts electron/ipc/handlers.ts electron/preload.ts src/types/electron.d.ts src/lib/ipc.ts
git commit -m "Wire finance CRUD through IPC"
```

---

### Task 3: Finance zustand store

**Files:**
- Create: `src/lib/store/financeStore.ts`

**Interfaces:**
- Consumes: every `ipc.*Finance*` function from Task 2.
- Produces: `useFinanceStore` hook with state `{ categories: FinanceCategory[], transactions: FinanceTransaction[], savingsEntries: FinanceSavingsEntry[], loading: boolean, error: string | null }` and actions `loadAll()`, `createCategory(input)`, `updateCategory(id, input)`, `archiveCategory(id)`, `createTransaction(input)`, `updateTransaction(id, input)`, `deleteTransaction(id)`, `createSavingsEntry(input)`, `deleteSavingsEntry(id)`.

- [ ] **Step 1: Write the store**

Create `src/lib/store/financeStore.ts`:

```ts
'use client'
import { create } from 'zustand'
import type {
  FinanceCategory, FinanceTransaction, FinanceSavingsEntry,
  CreateFinanceCategoryInput, UpdateFinanceCategoryInput,
  CreateFinanceTransactionInput, UpdateFinanceTransactionInput,
  CreateFinanceSavingsEntryInput,
} from '../../../shared/types'
import * as ipc from '../ipc'

interface FinanceStore {
  categories: FinanceCategory[]
  transactions: FinanceTransaction[]
  savingsEntries: FinanceSavingsEntry[]
  loading: boolean
  error: string | null

  loadAll: () => Promise<void>

  createCategory: (input: CreateFinanceCategoryInput) => Promise<FinanceCategory>
  updateCategory: (id: string, input: UpdateFinanceCategoryInput) => Promise<void>
  archiveCategory: (id: string) => Promise<void>

  createTransaction: (input: CreateFinanceTransactionInput) => Promise<void>
  updateTransaction: (id: string, input: UpdateFinanceTransactionInput) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>

  createSavingsEntry: (input: CreateFinanceSavingsEntryInput) => Promise<void>
  deleteSavingsEntry: (id: string) => Promise<void>
}

export const useFinanceStore = create<FinanceStore>((set) => ({
  categories: [],
  transactions: [],
  savingsEntries: [],
  loading: false,
  error: null,

  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const [categories, transactions, savingsEntries] = await Promise.all([
        ipc.listFinanceCategories(),
        ipc.listFinanceTransactions(),
        ipc.listFinanceSavingsEntries(),
      ])
      set({ categories, transactions, savingsEntries, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createCategory: async (input) => {
    const category = await ipc.createFinanceCategory(input)
    set((s) => ({ categories: [...s.categories, category] }))
    return category
  },

  updateCategory: async (id, input) => {
    const updated = await ipc.updateFinanceCategory(id, input)
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? updated : c)) }))
  },

  archiveCategory: async (id) => {
    await ipc.archiveFinanceCategory(id)
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? { ...c, archivedAt: Date.now() } : c)),
    }))
  },

  createTransaction: async (input) => {
    const transaction = await ipc.createFinanceTransaction(input)
    set((s) => ({ transactions: [...s.transactions, transaction] }))
  },

  updateTransaction: async (id, input) => {
    const updated = await ipc.updateFinanceTransaction(id, input)
    set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? updated : t)) }))
  },

  deleteTransaction: async (id) => {
    await ipc.deleteFinanceTransaction(id)
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }))
  },

  createSavingsEntry: async (input) => {
    const entry = await ipc.createFinanceSavingsEntry(input)
    set((s) => ({ savingsEntries: [...s.savingsEntries, entry] }))
  },

  deleteSavingsEntry: async (id) => {
    await ipc.deleteFinanceSavingsEntry(id)
    set((s) => ({ savingsEntries: s.savingsEntries.filter((e) => e.id !== id) }))
  },
}))
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/store/financeStore.ts
git commit -m "Add finance zustand store"
```

---

### Task 4: Sidebar navigation entry

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Produces: a `/finance` route entry in the sidebar, positioned between Wish List and Projects.

- [ ] **Step 1: Add the icon import and nav entry**

In `src/components/layout/Sidebar.tsx`, change the lucide-react import line:

```ts
import { LayoutGrid, CheckSquare, FolderOpen, Target, Settings, Heart, Wallet } from 'lucide-react'
```

Then update `NAV_ITEMS`:

```ts
const NAV_ITEMS = [
  { href: '/',           icon: LayoutGrid,  label: 'Habit Scorecard' },
  { href: '/tasks',      icon: CheckSquare, label: 'Current Tasks' },
  { href: '/wishlist',   icon: Heart,       label: 'Wish List' },
  { href: '/finance',    icon: Wallet,      label: 'Finance' },
  { href: '/projects',   icon: FolderOpen,  label: 'Projects' },
  { href: '/goals',      icon: Target,      label: 'Long-Term Goals' },
]
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output. (The `/finance` route won't exist until Task 5 — that's fine, `Link` doesn't fail typecheck for an as-yet-missing route.)

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "Add Finance entry to sidebar nav"
```

---

### Task 5: Finance page shell + transaction CRUD (Add/Edit modal, row, list)

**Files:**
- Create: `src/app/finance/page.tsx`
- Create: `src/components/finance/TransactionModal.tsx`
- Create: `src/components/finance/TransactionRow.tsx`

**Interfaces:**
- Consumes: `useFinanceStore` (Task 3), `FinanceTransaction`, `FinanceCategory` (Task 1).
- Produces: a working `/finance` page with a **Dashboard | Savings** tab bar (Savings tab is a placeholder stub until Task 10), an "+ Add Spending" button opening `TransactionModal`, and an unfiltered (all transactions, newest-first) list using `TransactionRow`. `TransactionModal` is used for both add and edit (`mode: 'add' | 'edit'`, optional `transaction` prop for edit) and includes inline category creation.

- [ ] **Step 1: Write `TransactionModal.tsx`**

Create `src/components/finance/TransactionModal.tsx`:

```tsx
'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { FinanceCategory, FinanceTransaction, CreateFinanceTransactionInput } from '@shared/types'
import { useFinanceStore } from '@/lib/store/financeStore'
import { format } from 'date-fns'

const PRESET_COLORS = [
  '#E879B9', '#A78BFA', '#34D399', '#60A5FA',
  '#FBBF24', '#F87171', '#86EFAC', '#818CF8',
] as const

interface TransactionModalProps {
  mode: 'add' | 'edit'
  transaction?: FinanceTransaction
  categories: FinanceCategory[]
  onClose: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

export function TransactionModal({ mode, transaction, categories, onClose }: TransactionModalProps) {
  const { createTransaction, updateTransaction, createCategory } = useFinanceStore()

  const [title, setTitle] = useState(transaction?.title ?? '')
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [date, setDate] = useState(transaction?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.categoryId ?? null)
  const [titleError, setTitleError] = useState('')
  const [saving, setSaving] = useState(false)

  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState<string>(PRESET_COLORS[0])

  const titleInputRef = useRef<HTMLInputElement>(null)
  const activeCategories = categories.filter((c) => c.archivedAt === null)

  useEffect(() => {
    const id = setTimeout(() => titleInputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.isComposing) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) onClose() },
    [onClose]
  )

  const handleCreateCategory = useCallback(async () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) return
    const category = await createCategory({ name: trimmed, color: newCategoryColor })
    setCategoryId(category.id)
    setNewCategoryName('')
    setShowNewCategory(false)
  }, [newCategoryName, newCategoryColor, createCategory])

  const handleSave = useCallback(async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setTitleError('Title is required')
      titleInputRef.current?.focus()
      return
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    setTitleError('')
    setSaving(true)
    try {
      if (mode === 'add') {
        const input: CreateFinanceTransactionInput = { title: trimmedTitle, amount: parsedAmount, date, categoryId }
        await createTransaction(input)
      } else if (transaction) {
        await updateTransaction(transaction.id, { title: trimmedTitle, amount: parsedAmount, date, categoryId })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }, [title, amount, date, categoryId, mode, transaction, createTransaction, updateTransaction, onClose])

  return (
    <div
      onClick={handleBackdropClick}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: 28, width: 440, maxWidth: '90vw', boxSizing: 'border-box' }}
      >
        <h2 id="transaction-modal-title" style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          {mode === 'add' ? 'Add Spending' : 'Edit Spending'}
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="tx-title-input" style={labelStyle}>Title</label>
          <input
            id="tx-title-input"
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="e.g. Groceries"
            style={{ ...inputStyle, border: `1px solid ${titleError ? '#f87171' : 'var(--border-subtle)'}` }}
          />
          {titleError && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>{titleError}</p>}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="tx-amount-input" style={labelStyle}>Amount (Rs.)</label>
            <input
              id="tx-amount-input"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="tx-date-input" style={labelStyle}>Date</label>
            <input
              id="tx-date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Category</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => setCategoryId(null)}
              style={{
                padding: '5px 12px', borderRadius: 16, fontSize: 13, cursor: 'pointer',
                border: `1px solid ${categoryId === null ? 'var(--accent)' : 'var(--border-subtle)'}`,
                backgroundColor: categoryId === null ? 'var(--accent-soft)' : 'transparent',
                color: categoryId === null ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              Uncategorized
            </button>
            {activeCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 16, fontSize: 13, cursor: 'pointer',
                  border: `1px solid ${categoryId === c.id ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  backgroundColor: categoryId === c.id ? 'var(--accent-soft)' : 'transparent',
                  color: categoryId === c.id ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.color, flexShrink: 0 }} />
                {c.name}
              </button>
            ))}
            <button
              onClick={() => setShowNewCategory((v) => !v)}
              style={{ padding: '5px 12px', borderRadius: 16, fontSize: 13, cursor: 'pointer', border: '1px dashed var(--border-strong)', backgroundColor: 'transparent', color: 'var(--text-secondary)' }}
            >
              + New
            </button>
          </div>

          {showNewCategory && (
            <div style={{ backgroundColor: 'var(--bg-surface-2)', borderRadius: 8, padding: 12, marginTop: 10 }}>
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewCategoryColor(color)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', backgroundColor: color, border: 'none', cursor: 'pointer', padding: 0,
                      outline: newCategoryColor === color ? '2px solid var(--text-primary)' : 'none', outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowNewCategory(false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCreateCategory} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Add</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Write `TransactionRow.tsx`**

Create `src/components/finance/TransactionRow.tsx`:

```tsx
'use client'
import React from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import type { FinanceTransaction, FinanceCategory } from '@shared/types'

interface TransactionRowProps {
  transaction: FinanceTransaction
  category?: FinanceCategory
  onEdit: () => void
  onDelete: () => void
}

export function TransactionRow({ transaction, category, onEdit, onDelete }: TransactionRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: category?.color ?? 'var(--text-tertiary)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>{transaction.title}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
          {category?.name ?? 'Uncategorized'} &middot; {format(new Date(transaction.date + 'T12:00:00'), 'MMM d, yyyy')}
        </p>
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
        Rs. {transaction.amount.toLocaleString()}
      </span>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={onEdit} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Edit">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', color: '#F87171' }} title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the page shell**

Create `src/app/finance/page.tsx`:

```tsx
'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useFinanceStore } from '@/lib/store/financeStore'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { TransactionModal } from '@/components/finance/TransactionModal'
import { TransactionRow } from '@/components/finance/TransactionRow'
import type { FinanceTransaction } from '@shared/types'

type ModalState = { type: 'add' } | { type: 'edit'; transaction: FinanceTransaction } | null

export default function FinancePage() {
  const [innerTab, setInnerTab] = useState<'dashboard' | 'savings'>('dashboard')
  const [modalState, setModalState] = useState<ModalState>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const { categories, transactions, loadAll, deleteTransaction } = useFinanceStore()

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date))),
    [transactions]
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    await deleteTransaction(pendingDeleteId)
    setPendingDeleteId(null)
  }, [pendingDeleteId, deleteTransaction])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-base)', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
      <div style={{ padding: '20px 32px 0', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Finance</h2>
          {innerTab === 'dashboard' && (
            <button
              onClick={() => setModalState({ type: 'add' })}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
            >
              + Add Spending
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {(['dashboard', 'savings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setInnerTab(tab)}
              style={{
                padding: '6px 16px', borderRadius: '8px 8px 0 0', border: 'none',
                backgroundColor: innerTab === tab ? 'var(--bg-surface-2)' : 'transparent',
                color: innerTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: innerTab === tab ? 500 : 400, fontSize: 14, cursor: 'pointer',
              }}
            >
              {tab === 'dashboard' ? 'Dashboard' : 'Savings'}
            </button>
          ))}
        </div>

        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', paddingBottom: 10 }}>
          Track what you spend, what you save, and what's left.
        </p>
      </div>

      {innerTab === 'dashboard' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
          {sortedTransactions.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, color: 'var(--text-tertiary)', fontSize: 14 }}>
              No spendings logged yet. Click &quot;+ Add Spending&quot; to get started.
            </div>
          ) : (
            sortedTransactions.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                category={t.categoryId ? categoryMap.get(t.categoryId) : undefined}
                onEdit={() => setModalState({ type: 'edit', transaction: t })}
                onDelete={() => setPendingDeleteId(t.id)}
              />
            ))
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
          Savings tab coming in a later task.
        </div>
      )}

      <AnimatePresence>
        {modalState && (
          <TransactionModal
            key={modalState.type === 'edit' ? modalState.transaction.id : 'add'}
            mode={modalState.type}
            transaction={modalState.type === 'edit' ? modalState.transaction : undefined}
            categories={categories}
            onClose={() => setModalState(null)}
          />
        )}
      </AnimatePresence>

      {pendingDeleteId && (
        <ConfirmDeleteModal
          title="Delete Spending?"
          message="This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

Run: `npx next build`
Expected: succeeds, `/finance` appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add src/app/finance/page.tsx src/components/finance/TransactionModal.tsx src/components/finance/TransactionRow.tsx
git commit -m "Add Finance page shell with transaction add/edit/delete"
```

---

### Task 6: Month navigation, stat tiles, and editable budget strip

**Files:**
- Create: `src/components/finance/FinanceDashboard.tsx`
- Create: `src/components/finance/BudgetStrip.tsx`
- Modify: `src/app/finance/page.tsx`

**Interfaces:**
- Consumes: `sumForMonth`, `sumForWeek` (Task 1, `shared/financeLogic.ts`); `useFinanceStore` (Task 3); `useSettingsStore` (existing) + `SETTING_KEYS.MONTHLY_BUDGET` (Task 1).
- Produces: `FinanceDashboard` component owning `viewedMonth` state (prev/next arrows, same UX as the Habit grid's month nav) and rendering 4 stat tiles + `BudgetStrip`; replaces the flat transaction list in `page.tsx`'s dashboard branch, now scoped to `viewedMonth`.

- [ ] **Step 1: Write `BudgetStrip.tsx`**

Create `src/components/finance/BudgetStrip.tsx`:

```tsx
'use client'
import React, { useState, useCallback } from 'react'
import { Pencil } from 'lucide-react'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { SETTING_KEYS } from '@shared/types'

interface BudgetStripProps {
  spent: number
}

export function BudgetStrip({ spent }: BudgetStripProps) {
  const budgetStr = useSettingsStore((s) => s.get(SETTING_KEYS.MONTHLY_BUDGET))
  const setSetting = useSettingsStore((s) => s.set)
  const budget = parseFloat(budgetStr ?? '0') || 0

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(budget))

  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0
  const overBudget = budget > 0 && spent > budget

  const handleStartEdit = useCallback(() => {
    setDraft(String(budget))
    setEditing(true)
  }, [budget])

  const handleSave = useCallback(async () => {
    const parsed = parseFloat(draft)
    await setSetting(SETTING_KEYS.MONTHLY_BUDGET, String(isNaN(parsed) ? 0 : parsed))
    setEditing(false)
  }, [draft, setSetting])

  return (
    <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Monthly Budget</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number" min="0" step="0.01" value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              style={{ width: 110, boxSizing: 'border-box', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 8px', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
            />
            <button onClick={() => setEditing(false)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Save</button>
          </div>
        ) : (
          <button onClick={handleStartEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>

      <div style={{ height: 8, borderRadius: 4, backgroundColor: 'var(--bg-surface-2)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, backgroundColor: overBudget ? '#F87171' : 'var(--accent)', transition: 'width 200ms' }} />
      </div>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
        Rs. {spent.toLocaleString()} of Rs. {budget.toLocaleString()} spent ({pct}%){overBudget ? ' — over budget' : ''}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Write `FinanceDashboard.tsx`**

Create `src/components/finance/FinanceDashboard.tsx`:

```tsx
'use client'
import React, { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { useFinanceStore } from '@/lib/store/financeStore'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { SETTING_KEYS } from '@shared/types'
import { sumForMonth, sumForWeek, getMonthRange } from '@shared/financeLogic'
import { BudgetStrip } from './BudgetStrip'
import { TransactionRow } from './TransactionRow'
import { TransactionModal } from './TransactionModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { AnimatePresence } from 'framer-motion'
import type { FinanceTransaction } from '@shared/types'

type ModalState = { type: 'edit'; transaction: FinanceTransaction } | null

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 0', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 18px' }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

export function FinanceDashboard() {
  const [viewedMonth, setViewedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [modalState, setModalState] = useState<ModalState>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const { categories, transactions, deleteTransaction } = useFinanceStore()
  const budgetStr = useSettingsStore((s) => s.get(SETTING_KEYS.MONTHLY_BUDGET))
  const budget = parseFloat(budgetStr ?? '0') || 0

  const today = format(new Date(), 'yyyy-MM-dd')
  const spentThisMonth = useMemo(() => sumForMonth(transactions, viewedMonth), [transactions, viewedMonth])
  const spentThisWeek = useMemo(() => sumForWeek(transactions, today), [transactions, today])
  const remaining = budget - spentThisMonth

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const monthTransactions = useMemo(() => {
    const { start, end } = getMonthRange(viewedMonth)
    return transactions
      .filter((t) => t.date >= start && t.date <= end)
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)))
  }, [transactions, viewedMonth])

  const goToPrevMonth = useCallback(() => {
    setViewedMonth((m) => format(subMonths(new Date(m + '-01'), 1), 'yyyy-MM'))
  }, [])
  const goToNextMonth = useCallback(() => {
    setViewedMonth((m) => format(addMonths(new Date(m + '-01'), 1), 'yyyy-MM'))
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    await deleteTransaction(pendingDeleteId)
    setPendingDeleteId(null)
  }, [pendingDeleteId, deleteTransaction])

  const monthLabel = format(new Date(viewedMonth + '-01'), 'MMMM yyyy')

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
        <button onClick={goToPrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', minWidth: 140, textAlign: 'center' }}>{monthLabel}</span>
        <button onClick={goToNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <StatTile label="Monthly Budget" value={`Rs. ${budget.toLocaleString()}`} />
        <StatTile label="Spent This Month" value={`Rs. ${spentThisMonth.toLocaleString()}`} />
        <StatTile label="Remaining" value={`Rs. ${remaining.toLocaleString()}`} />
        <StatTile label="Spent This Week" value={`Rs. ${spentThisWeek.toLocaleString()}`} />
      </div>

      <BudgetStrip spent={spentThisMonth} />

      <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Spendings — {monthLabel}
      </h3>
      {monthTransactions.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No spendings logged for {monthLabel}.</p>
      ) : (
        monthTransactions.map((t) => (
          <TransactionRow
            key={t.id}
            transaction={t}
            category={t.categoryId ? categoryMap.get(t.categoryId) : undefined}
            onEdit={() => setModalState({ type: 'edit', transaction: t })}
            onDelete={() => setPendingDeleteId(t.id)}
          />
        ))
      )}

      <AnimatePresence>
        {modalState && (
          <TransactionModal
            key={modalState.transaction.id}
            mode="edit"
            transaction={modalState.transaction}
            categories={categories}
            onClose={() => setModalState(null)}
          />
        )}
      </AnimatePresence>

      {pendingDeleteId && (
        <ConfirmDeleteModal
          title="Delete Spending?"
          message="This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Replace `src/app/finance/page.tsx` in full**

Month-scoped stat tiles, the budget strip, and the transaction list now live inside `FinanceDashboard` (Steps 1-2), so the page itself sheds all of that responsibility — it becomes a thin shell owning only the tab switch and the "+ Add Spending" modal (which is not month-scoped). Replace the **entire contents** of `src/app/finance/page.tsx` with:

```tsx
'use client'
import React, { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useFinanceStore } from '@/lib/store/financeStore'
import { TransactionModal } from '@/components/finance/TransactionModal'
import { FinanceDashboard } from '@/components/finance/FinanceDashboard'

export default function FinancePage() {
  const [innerTab, setInnerTab] = useState<'dashboard' | 'savings'>('dashboard')
  const [showAddModal, setShowAddModal] = useState(false)

  const { categories, loadAll } = useFinanceStore()

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-base)', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
      <div style={{ padding: '20px 32px 0', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Finance</h2>
          {innerTab === 'dashboard' && (
            <button
              onClick={() => setShowAddModal(true)}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
            >
              + Add Spending
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {(['dashboard', 'savings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setInnerTab(tab)}
              style={{
                padding: '6px 16px', borderRadius: '8px 8px 0 0', border: 'none',
                backgroundColor: innerTab === tab ? 'var(--bg-surface-2)' : 'transparent',
                color: innerTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: innerTab === tab ? 500 : 400, fontSize: 14, cursor: 'pointer',
              }}
            >
              {tab === 'dashboard' ? 'Dashboard' : 'Savings'}
            </button>
          ))}
        </div>

        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', paddingBottom: 10 }}>
          Track what you spend, what you save, and what&apos;s left.
        </p>
      </div>

      {innerTab === 'dashboard' ? <FinanceDashboard /> : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
          Savings tab coming in a later task.
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <TransactionModal mode="add" categories={categories} onClose={() => setShowAddModal(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
```

This drops the page's own `pendingDeleteId`/`ConfirmDeleteModal`, `categoryMap`/`sortedTransactions` memos, and the flat `TransactionRow` list from Task 5 entirely — all of that is superseded by `FinanceDashboard`, which owns its own delete-confirmation state independently (see Step 2's `FinanceDashboard.tsx` code above).

- [ ] **Step 4: Verify typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json && npx next build`
Expected: both clean/succeed.

- [ ] **Step 5: Commit**

```bash
git add src/components/finance/FinanceDashboard.tsx src/components/finance/BudgetStrip.tsx src/app/finance/page.tsx
git commit -m "Add month navigation, stat tiles, and editable budget strip to Finance dashboard"
```

---

### Task 7: Spending Trend chart (line, last 6 months)

**Files:**
- Create: `src/components/finance/SpendingTrendChart.tsx`
- Modify: `src/components/finance/FinanceDashboard.tsx`

**Interfaces:**
- Consumes: `getMonthlyTrend` (Task 1).
- Produces: `<SpendingTrendChart data={Array<{ month: string; total: number }>} />`, rendered inside `FinanceDashboard` above the transaction list.

- [ ] **Step 1: Write `SpendingTrendChart.tsx`**

Create `src/components/finance/SpendingTrendChart.tsx`:

```tsx
'use client'
import React, { useState, useMemo } from 'react'
import { format } from 'date-fns'

interface SpendingTrendChartProps {
  data: Array<{ month: string; total: number }>
}

const WIDTH = 460
const HEIGHT = 180
const PADDING = { top: 12, right: 12, bottom: 24, left: 48 }

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const maxValue = Math.max(1, ...data.map((d) => d.total))
  // Round the axis ceiling up to a clean step
  const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxValue)) - 1))
  const axisMax = Math.ceil(maxValue / step) * step || 1

  const points = useMemo(
    () =>
      data.map((d, i) => {
        const x = PADDING.left + (data.length === 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth)
        const y = PADDING.top + plotHeight - (d.total / axisMax) * plotHeight
        return { x, y, ...d }
      }),
    [data, plotWidth, plotHeight, axisMax]
  )

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? PADDING.left} ${PADDING.top + plotHeight} L ${points[0]?.x ?? PADDING.left} ${PADDING.top + plotHeight} Z`

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: PADDING.top + plotHeight * (1 - f),
    value: Math.round(axisMax * f),
  }))

  const hovered = hoverIndex !== null ? points[hoverIndex] : null

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: 'block' }}>
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={g.y} y2={g.y} stroke="var(--border-subtle)" strokeWidth={1} />
            <text x={PADDING.left - 8} y={g.y + 4} fontSize={10} fill="var(--text-tertiary)" textAnchor="end">
              {g.value >= 1000 ? `${Math.round(g.value / 1000)}k` : g.value}
            </text>
          </g>
        ))}

        {points.length > 1 && <path d={areaPath} fill="var(--accent)" opacity={0.1} stroke="none" />}
        {points.length > 1 && <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

        {points.map((p, i) => (
          <g key={p.month}>
            <circle cx={p.x} cy={p.y} r={5} fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth={2} />
            <circle
              cx={p.x} cy={p.y} r={12} fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: 'pointer' }}
            />
            <text x={p.x} y={HEIGHT - 6} fontSize={10} fill="var(--text-tertiary)" textAnchor="middle">
              {format(new Date(p.month + '-01'), 'MMM')}
            </text>
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: `${(hovered.x / WIDTH) * 100}%`,
            top: hovered.y - 44,
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>Rs. {hovered.total.toLocaleString()}</strong>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>{format(new Date(hovered.month + '-01'), 'MMMM yyyy')}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `FinanceDashboard.tsx`**

Add the import: `import { SpendingTrendChart } from './SpendingTrendChart'` and `import { getMonthlyTrend } from '@shared/financeLogic'`.

Add a memo after `monthTransactions`:

```tsx
  const trendData = useMemo(() => getMonthlyTrend(transactions, viewedMonth, 6), [transactions, viewedMonth])
```

Insert the chart card between `<BudgetStrip spent={spentThisMonth} />` and the "Spendings — {monthLabel}" heading:

```tsx
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Spending Trend
        </h3>
        <SpendingTrendChart data={trendData} />
      </div>
```

- [ ] **Step 3: Verify typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json && npx next build`
Expected: both clean/succeed.

- [ ] **Step 4: Commit**

```bash
git add src/components/finance/SpendingTrendChart.tsx src/components/finance/FinanceDashboard.tsx
git commit -m "Add spending trend chart to Finance dashboard"
```

---

### Task 8: This Week chart (bar, Mon-Sun)

**Files:**
- Create: `src/components/finance/WeeklySpendingChart.tsx`
- Modify: `src/components/finance/FinanceDashboard.tsx`

**Interfaces:**
- Consumes: `getWeekdayTotals` (Task 1).
- Produces: `<WeeklySpendingChart data={number[]} />` (7 entries, Mon..Sun), rendered side-by-side with `SpendingTrendChart`.

- [ ] **Step 1: Write `WeeklySpendingChart.tsx`**

Create `src/components/finance/WeeklySpendingChart.tsx`:

```tsx
'use client'
import React, { useState } from 'react'

interface WeeklySpendingChartProps {
  data: number[] // 7 entries, Monday..Sunday
}

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WIDTH = 460
const HEIGHT = 180
const PADDING = { top: 12, right: 12, bottom: 24, left: 48 }
const BAR_RADIUS = 4
const MAX_BAR_WIDTH = 24

function topRoundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, height, width / 2)
  return `
    M ${x} ${y + height}
    L ${x} ${y + r}
    Q ${x} ${y} ${x + r} ${y}
    L ${x + width - r} ${y}
    Q ${x + width} ${y} ${x + width} ${y + r}
    L ${x + width} ${y + height}
    Z
  `
}

export function WeeklySpendingChart({ data }: WeeklySpendingChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const maxValue = Math.max(1, ...data)
  const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxValue)) - 1))
  const axisMax = Math.ceil(maxValue / step) * step || 1

  const slotWidth = plotWidth / 7
  const barWidth = Math.min(MAX_BAR_WIDTH, slotWidth * 0.6)

  const gridLines = [0, 0.5, 1].map((f) => ({
    y: PADDING.top + plotHeight * (1 - f),
    value: Math.round(axisMax * f),
  }))

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: 'block' }}>
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={g.y} y2={g.y} stroke="var(--border-subtle)" strokeWidth={1} />
            <text x={PADDING.left - 8} y={g.y + 4} fontSize={10} fill="var(--text-tertiary)" textAnchor="end">
              {g.value >= 1000 ? `${Math.round(g.value / 1000)}k` : g.value}
            </text>
          </g>
        ))}

        {data.map((value, i) => {
          const slotCenter = PADDING.left + slotWidth * (i + 0.5)
          const barHeight = (value / axisMax) * plotHeight
          const barX = slotCenter - barWidth / 2
          const barY = PADDING.top + plotHeight - barHeight
          const isHovered = hoverIndex === i

          return (
            <g key={i}>
              <path
                d={topRoundedRectPath(barX, barY, barWidth, Math.max(barHeight, 1), BAR_RADIUS)}
                fill="var(--accent)"
                opacity={isHovered ? 0.85 : 1}
              />
              <rect
                x={slotCenter - slotWidth / 2} y={PADDING.top} width={slotWidth} height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{ cursor: 'pointer' }}
              />
              <text x={slotCenter} y={HEIGHT - 6} fontSize={10} fill="var(--text-tertiary)" textAnchor="middle">
                {LABELS[i]}
              </text>
            </g>
          )
        })}
      </svg>

      {hoverIndex !== null && (() => {
        const barTopY = PADDING.top + plotHeight - (data[hoverIndex] / axisMax) * plotHeight
        return (
          <div
            style={{
              position: 'absolute',
              // Both left and top are expressed as percentages of the same coordinate
              // space the SVG itself scales within (WIDTH/HEIGHT), so the tooltip stays
              // correctly positioned regardless of the container's actual rendered size —
              // never a raw viewBox-unit value used as a literal CSS pixel offset.
              left: `${((PADDING.left + slotWidth * (hoverIndex + 0.5)) / WIDTH) * 100}%`,
              top: `${(barTopY / HEIGHT) * 100}%`,
              transform: 'translate(-50%, calc(-100% - 8px))',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>Rs. {data[hoverIndex].toLocaleString()}</strong>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>{LABELS[hoverIndex]}</span>
          </div>
        )
      })()}
    </div>
  )
}
```

- [ ] **Step 2: Wire it side-by-side with the trend chart in `FinanceDashboard.tsx`**

Add the import: `import { WeeklySpendingChart } from './WeeklySpendingChart'` and `import { getWeekdayTotals } from '@shared/financeLogic'`.

Add a memo:

```tsx
  const weekdayTotals = useMemo(() => getWeekdayTotals(transactions, today), [transactions, today])
```

Replace the single Spending Trend card block from Task 7 with a two-column row:

```tsx
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: '1 1 380px', minWidth: 320, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Spending Trend
          </h3>
          <SpendingTrendChart data={trendData} />
        </div>
        <div style={{ flex: '1 1 380px', minWidth: 320, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            This Week
          </h3>
          <WeeklySpendingChart data={weekdayTotals} />
        </div>
      </div>
```

- [ ] **Step 3: Verify typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json && npx next build`
Expected: both clean/succeed.

- [ ] **Step 4: Commit**

```bash
git add src/components/finance/WeeklySpendingChart.tsx src/components/finance/FinanceDashboard.tsx
git commit -m "Add this-week spending chart to Finance dashboard"
```

---

### Task 9: Category breakdown donut

**Files:**
- Create: `src/components/finance/CategoryDonut.tsx`
- Modify: `src/components/finance/FinanceDashboard.tsx`

**Interfaces:**
- Consumes: `getCategoryBreakdown`, `CategoryBreakdownEntry` (Task 1).
- Produces: `<CategoryDonut entries={CategoryBreakdownEntry[]} />`, rendered below the two charts.

- [ ] **Step 1: Write `CategoryDonut.tsx`**

Create `src/components/finance/CategoryDonut.tsx`:

```tsx
'use client'
import React from 'react'
import type { CategoryBreakdownEntry } from '@shared/financeLogic'

interface CategoryDonutProps {
  entries: CategoryBreakdownEntry[]
}

export function CategoryDonut({ entries }: CategoryDonutProps) {
  const size = 140
  const strokeWidth = 18
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = entries.reduce((sum, e) => sum + e.total, 0)
  const gap = entries.length > 1 ? 3 : 0

  let cumulativeOffset = 0
  const slices = entries.map((e) => {
    const fraction = total > 0 ? e.total / total : 0
    const length = Math.max(circumference * fraction - gap, 0)
    const offset = -cumulativeOffset
    cumulativeOffset += circumference * fraction
    return { ...e, length, offset }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={strokeWidth} />
            {total > 0 &&
              slices.map((s) => (
                <circle
                  key={s.categoryId ?? 'uncategorized'}
                  cx={size / 2} cy={size / 2} r={radius} fill="none"
                  stroke={s.color} strokeWidth={strokeWidth} strokeLinecap="round"
                  strokeDasharray={`${s.length} ${circumference - s.length}`}
                  strokeDashoffset={s.offset}
                />
              ))}
          </g>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Rs. {total.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>spent</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No categorized spending this month.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((e) => (
            <div key={e.categoryId ?? 'uncategorized'} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: e.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {e.name} <strong style={{ color: 'var(--text-primary)' }}>Rs. {e.total.toLocaleString()}</strong>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `FinanceDashboard.tsx`**

Add the import: `import { CategoryDonut } from './CategoryDonut'` and `import { getCategoryBreakdown } from '@shared/financeLogic'`.

Add a memo:

```tsx
  const categoryBreakdown = useMemo(
    () => getCategoryBreakdown(transactions, categories, viewedMonth),
    [transactions, categories, viewedMonth]
  )
```

Insert a card between the two-chart row (Task 8) and the "Spendings — {monthLabel}" heading:

```tsx
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          By Category
        </h3>
        <CategoryDonut entries={categoryBreakdown} />
      </div>
```

- [ ] **Step 3: Verify typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json && npx next build`
Expected: both clean/succeed.

- [ ] **Step 4: Commit**

```bash
git add src/components/finance/CategoryDonut.tsx src/components/finance/FinanceDashboard.tsx
git commit -m "Add category breakdown donut to Finance dashboard"
```

---

### Task 10: Savings tab + final integration verification

**Files:**
- Create: `src/components/finance/FinanceSavingsTab.tsx`
- Create: `src/components/finance/SavingsEntryRow.tsx`
- Modify: `src/app/finance/page.tsx`

**Interfaces:**
- Consumes: `useFinanceStore` (Task 3, `savingsEntries`/`createSavingsEntry`/`deleteSavingsEntry`).
- Produces: a fully working Savings tab; this is the last task, so it closes with an end-to-end manual verification pass of the whole feature.

- [ ] **Step 1: Write `SavingsEntryRow.tsx`**

Create `src/components/finance/SavingsEntryRow.tsx`:

```tsx
'use client'
import React from 'react'
import { Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import type { FinanceSavingsEntry } from '@shared/types'

interface SavingsEntryRowProps {
  entry: FinanceSavingsEntry
  onDelete: () => void
}

export function SavingsEntryRow({ entry, onDelete }: SavingsEntryRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>{entry.note ?? 'Savings deposit'}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
          {format(new Date(entry.date + 'T12:00:00'), 'MMM d, yyyy')}
        </p>
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: entry.amount >= 0 ? '#34D399' : '#F87171', flexShrink: 0 }}>
        {entry.amount >= 0 ? '+' : ''}Rs. {entry.amount.toLocaleString()}
      </span>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', color: '#F87171', flexShrink: 0 }} title="Delete">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Write `FinanceSavingsTab.tsx`**

Create `src/components/finance/FinanceSavingsTab.tsx`:

```tsx
'use client'
import React, { useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { useFinanceStore } from '@/lib/store/financeStore'
import { SavingsEntryRow } from './SavingsEntryRow'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 14px',
  fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
}

export function FinanceSavingsTab() {
  const { savingsEntries, createSavingsEntry, deleteSavingsEntry } = useFinanceStore()

  const [showAdd, setShowAdd] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const totalSaved = useMemo(() => savingsEntries.reduce((sum, e) => sum + e.amount, 0), [savingsEntries])
  const sortedEntries = useMemo(
    () => [...savingsEntries].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date))),
    [savingsEntries]
  )

  const handleAdd = useCallback(async () => {
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed === 0) return
    await createSavingsEntry({ amount: parsed, note: note.trim() || undefined, date: format(new Date(), 'yyyy-MM-dd') })
    setAmount('')
    setNote('')
    setShowAdd(false)
  }, [amount, note, createSavingsEntry])

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    await deleteSavingsEntry(pendingDeleteId)
    setPendingDeleteId(null)
  }, [pendingDeleteId, deleteSavingsEntry])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px', marginBottom: 20, textAlign: 'center' }}>
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Saved</p>
        <p style={{ margin: '0 0 16px', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>Rs. {totalSaved.toLocaleString()}</p>
        <button
          onClick={() => setShowAdd((v) => !v)}
          style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          + Add to Savings
        </button>

        {showAdd && (
          <div style={{ backgroundColor: 'var(--bg-surface-2)', borderRadius: 8, padding: 14, marginTop: 14, textAlign: 'left' }}>
            <div style={{ marginBottom: 8 }}>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (Rs.) — negative to withdraw" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAdd} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', backgroundColor: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Add</button>
            </div>
          </div>
        )}
      </div>

      {sortedEntries.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No savings entries yet.</p>
      ) : (
        sortedEntries.map((e) => (
          <SavingsEntryRow key={e.id} entry={e} onDelete={() => setPendingDeleteId(e.id)} />
        ))
      )}

      {pendingDeleteId && (
        <ConfirmDeleteModal
          title="Delete Savings Entry?"
          message="This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire it into the page**

In `src/app/finance/page.tsx`: add the import `import { FinanceSavingsTab } from '@/components/finance/FinanceSavingsTab'` and replace the Savings placeholder branch:

```tsx
{innerTab === 'dashboard' ? <FinanceDashboard /> : <FinanceSavingsTab />}
```

- [ ] **Step 4: Full verification pass**

Run: `npx jest`
Expected: all suites pass (36 tests: 24 pre-existing + 12 from Task 1).

Run: `npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.electron.json`
Expected: no output.

Run: `npx next build`
Expected: succeeds, `/finance` listed among the routes.

Run the actual app (`npm run dev`) and manually walk through, per the `run` skill's guidance to drive the app rather than just launch it:
1. Click "Finance" in the sidebar — page loads, Dashboard tab active, empty state shown.
2. Click "+ Add Spending" — add a transaction with a new category created inline via "+ New" — confirm it appears in the list with the correct category dot/name.
3. Confirm the 4 stat tiles, budget strip, both charts, and the category donut all update to reflect it.
4. Click the budget strip's Edit pencil, set a budget, Save — confirm the progress bar and percentage update.
5. Use the month prev/next arrows — confirm the list and stat tiles re-scope correctly to each month.
6. Edit a transaction (pencil icon) and confirm changes reflect everywhere; delete one (trash icon) and confirm the `ConfirmDeleteModal` gate works and totals update.
7. Switch to the Savings tab, add an entry, confirm the total and ledger update; delete it and confirm removal.

- [ ] **Step 5: Commit**

```bash
git add src/components/finance/FinanceSavingsTab.tsx src/components/finance/SavingsEntryRow.tsx src/app/finance/page.tsx
git commit -m "Add Savings tab, completing the Finance feature"
```
