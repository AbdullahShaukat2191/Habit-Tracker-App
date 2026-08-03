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
