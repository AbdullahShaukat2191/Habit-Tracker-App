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
