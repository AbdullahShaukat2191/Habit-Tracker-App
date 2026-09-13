'use client'
import React from 'react'

export interface StatBarCard {
  label: string
  value: string
  subtitle?: string
}

export function StatBar({ cards }: { cards: StatBarCard[] }) {
  return (
    <div style={{
      display: 'flex', backgroundColor: 'var(--bg-surface-2)', borderRadius: 12,
      padding: '18px 24px', marginBottom: 24,
    }}>
      {cards.map((card, i) => (
        <div key={card.label} style={{ flex: '1 1 0', paddingLeft: i === 0 ? 0 : 24 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{card.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{card.value}</div>
          {card.subtitle && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{card.subtitle}</div>
          )}
        </div>
      ))}
    </div>
  )
}
