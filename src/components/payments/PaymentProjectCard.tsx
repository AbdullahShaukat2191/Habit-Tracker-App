'use client'
import React, { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { PaymentProject } from '@shared/types'
import { formatCurrency } from '@/lib/currency'

interface PaymentProjectCardProps {
  paymentProject: PaymentProject
  paid: number
  milestonesTotal: number
  milestonesCleared: number
  onClick: () => void
}

export default function PaymentProjectCard({
  paymentProject,
  paid,
  milestonesTotal,
  milestonesCleared,
  onClick,
}: PaymentProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const remaining = paymentProject.totalAmount - paid
  const pct = paymentProject.totalAmount > 0 ? Math.min(100, Math.round((paid / paymentProject.totalAmount) * 100)) : 0

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${isHovered ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
        borderRadius: 12,
        padding: '18px 20px',
        marginBottom: 12,
        cursor: 'pointer',
        transition: 'border-color 150ms, box-shadow 150ms',
        boxShadow: isHovered ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 6,
            alignSelf: 'stretch',
            borderRadius: 3,
            backgroundColor: paymentProject.color,
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
              {paymentProject.name}
            </span>
            <ChevronRight size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          </div>

          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
            {paymentProject.developer ? `Dev: ${paymentProject.developer}` : 'No developer assigned'}
            {milestonesTotal > 0 ? ` · ${milestonesCleared} of ${milestonesTotal} milestones cleared` : ''}
          </p>

          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--bg-surface-2)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, backgroundColor: 'var(--accent)', transition: 'width 200ms' }} />
          </div>

          {/* Stat row */}
          <div style={{ display: 'flex', gap: 24 }}>
            <Stat label="Total" value={paymentProject.totalAmount} currency={paymentProject.currency} />
            <Stat label="Paid" value={paid} currency={paymentProject.currency} accent />
            <Stat label="Remaining" value={remaining} currency={paymentProject.currency} />
            <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{pct}%</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

function Stat({ label, value, currency, accent }: { label: string; value: number; currency: string; accent?: boolean }) {
  return (
    <div>
      <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>
        {formatCurrency(currency, value)}
      </p>
    </div>
  )
}
