'use client'
import React, { useState, useEffect } from 'react'
import { usePaymentStore } from '@/lib/store/paymentStore'
import PaymentProjectsTab from './PaymentProjectsTab'
import PaymentHistoryTab from './PaymentHistoryTab'

export default function PaymentsView() {
  const [innerTab, setInnerTab] = useState<'projects' | 'history'>('projects')
  const { loadAll } = usePaymentStore()

  useEffect(() => {
    loadAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '14px 32px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          {innerTab === 'projects' ? 'Projects' : 'Payment History'}
        </h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['projects', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setInnerTab(tab)}
              style={{
                padding: '6px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                backgroundColor: innerTab === tab ? 'var(--bg-surface-2)' : 'transparent',
                color: innerTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: innerTab === tab ? 500 : 400,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'background-color 150ms, color 150ms',
              }}
            >
              {tab === 'projects' ? 'Projects' : 'Payment History'}
            </button>
          ))}
        </div>
      </div>

      {innerTab === 'projects' ? <PaymentProjectsTab /> : <PaymentHistoryTab />}
    </div>
  )
}
