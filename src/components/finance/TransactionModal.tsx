'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { FinanceCategory, FinanceTransaction, CreateFinanceTransactionInput } from '@shared/types'
import { useFinanceStore } from '@/lib/store/financeStore'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { SETTING_KEYS } from '@shared/types'
import { getCurrencySymbol } from '@/lib/currency'
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
  const currency = useSettingsStore((s) => s.get(SETTING_KEYS.FINANCE_CURRENCY))

  const [title, setTitle] = useState(transaction?.title ?? '')
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [date, setDate] = useState(transaction?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.categoryId ?? null)
  const [titleError, setTitleError] = useState('')
  const [amountError, setAmountError] = useState('')
  const [saving, setSaving] = useState(false)

  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState<string>(PRESET_COLORS[0])

  const titleInputRef = useRef<HTMLInputElement>(null)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const activeCategories = categories.filter((c) => c.archivedAt === null)
  const categoriesToShow = (() => {
    if (transaction?.categoryId && !activeCategories.some((c) => c.id === transaction.categoryId)) {
      const archivedCategory = categories.find((c) => c.id === transaction.categoryId)
      if (archivedCategory) return [...activeCategories, archivedCategory]
    }
    return activeCategories
  })()

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
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError('Enter an amount greater than 0')
      amountInputRef.current?.focus()
      return
    }
    setTitleError('')
    setAmountError('')
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
            <label htmlFor="tx-amount-input" style={labelStyle}>Amount ({getCurrencySymbol(currency)})</label>
            <input
              id="tx-amount-input"
              ref={amountInputRef}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); if (amountError) setAmountError('') }}
              placeholder="0.00"
              style={{ ...inputStyle, border: `1px solid ${amountError ? '#f87171' : 'var(--border-subtle)'}` }}
            />
            {amountError && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>{amountError}</p>}
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
            {categoriesToShow.map((c) => (
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
                {c.name}{c.archivedAt !== null ? ' (archived)' : ''}
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
