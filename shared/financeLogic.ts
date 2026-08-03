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
