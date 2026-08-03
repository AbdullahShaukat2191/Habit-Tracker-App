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
