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
