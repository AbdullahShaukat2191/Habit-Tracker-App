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
