'use client'
import React from 'react'
import { Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import type { FinanceSavingsEntry } from '@shared/types'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { SETTING_KEYS } from '@shared/types'
import { formatCurrency } from '@/lib/currency'

interface SavingsEntryRowProps {
  entry: FinanceSavingsEntry
  onDelete: () => void
}

export function SavingsEntryRow({ entry, onDelete }: SavingsEntryRowProps) {
  const currency = useSettingsStore((s) => s.get(SETTING_KEYS.FINANCE_CURRENCY))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>{entry.note ?? 'Savings deposit'}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
          {format(new Date(entry.date + 'T12:00:00'), 'MMM d, yyyy')}
        </p>
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: entry.amount >= 0 ? '#34D399' : '#F87171', flexShrink: 0 }}>
        {entry.amount >= 0 ? '+' : ''}{formatCurrency(currency, entry.amount)}
      </span>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', color: '#F87171', flexShrink: 0 }} title="Delete">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
