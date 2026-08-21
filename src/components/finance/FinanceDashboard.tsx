'use client'
import React, { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { useFinanceStore } from '@/lib/store/financeStore'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { SETTING_KEYS } from '@shared/types'
import { sumForMonth, sumForWeek, getMonthRange, getMonthlyTrend, getWeekdayTotals, getCategoryBreakdown } from '@shared/financeLogic'
import { CURRENCIES, DEFAULT_CURRENCY, formatCurrency, type CurrencyCode } from '@/lib/currency'
import { BudgetStrip } from './BudgetStrip'
import { SpendingTrendChart } from './SpendingTrendChart'
import { WeeklySpendingChart } from './WeeklySpendingChart'
import { CategoryDonut } from './CategoryDonut'
import { TransactionRow } from './TransactionRow'
import { TransactionModal } from './TransactionModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { AnimatePresence } from 'framer-motion'
import type { FinanceTransaction } from '@shared/types'

type ModalState = { type: 'edit'; transaction: FinanceTransaction } | null

function parseMonthString(month: string): Date {
  const [year, monthNum] = month.split('-').map(Number)
  return new Date(year, monthNum - 1, 1)
}

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
  const currency = useSettingsStore((s) => s.get(SETTING_KEYS.FINANCE_CURRENCY))
  const setSetting = useSettingsStore((s) => s.set)

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

  const trendData = useMemo(() => getMonthlyTrend(transactions, viewedMonth, 6), [transactions, viewedMonth])
  const weekdayTotals = useMemo(() => getWeekdayTotals(transactions, today), [transactions, today])
  const categoryBreakdown = useMemo(
    () => getCategoryBreakdown(transactions, categories, viewedMonth),
    [transactions, categories, viewedMonth]
  )

  const goToPrevMonth = useCallback(() => {
    setViewedMonth((m) => format(subMonths(parseMonthString(m), 1), 'yyyy-MM'))
  }, [])
  const goToNextMonth = useCallback(() => {
    setViewedMonth((m) => format(addMonths(parseMonthString(m), 1), 'yyyy-MM'))
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    await deleteTransaction(pendingDeleteId)
    setPendingDeleteId(null)
  }, [pendingDeleteId, deleteTransaction])

  const monthLabel = format(parseMonthString(viewedMonth), 'MMMM yyyy')

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
        <button onClick={goToPrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', minWidth: 140, textAlign: 'center' }}>{monthLabel}</span>
        <button onClick={goToNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <ChevronRight size={18} />
        </button>
        <select
          value={currency ?? DEFAULT_CURRENCY}
          onChange={(e) => setSetting(SETTING_KEYS.FINANCE_CURRENCY, e.target.value)}
          style={{
            position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
            backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 6,
            padding: '4px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer',
          }}
        >
          {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
            <option key={code} value={code}>{code} ({CURRENCIES[code].prefix.trim()})</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <StatTile label="Monthly Budget" value={formatCurrency(currency, budget)} />
        <StatTile label="Spent This Month" value={formatCurrency(currency, spentThisMonth)} />
        <StatTile label="Remaining" value={formatCurrency(currency, remaining)} />
        <StatTile label="Spent This Week" value={formatCurrency(currency, spentThisWeek)} />
      </div>

      <BudgetStrip spent={spentThisMonth} />

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

      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          By Category
        </h3>
        <CategoryDonut entries={categoryBreakdown} />
      </div>

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
