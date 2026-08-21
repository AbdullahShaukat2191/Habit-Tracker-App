'use client'
import React from 'react'
import type { CategoryBreakdownEntry } from '@shared/financeLogic'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { SETTING_KEYS } from '@shared/types'
import { formatCurrency } from '@/lib/currency'
import { DonutChart } from '@/components/ui/DonutChart'

interface CategoryDonutProps {
  entries: CategoryBreakdownEntry[]
}

export function CategoryDonut({ entries }: CategoryDonutProps) {
  const currency = useSettingsStore((s) => s.get(SETTING_KEYS.FINANCE_CURRENCY))
  const size = 140
  const strokeWidth = 18
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = entries.reduce((sum, e) => sum + e.total, 0)
  const gap = entries.length > 1 ? 3 : 0

  let cumulativeOffset = 0
  const slices = entries.map((e) => {
    const fraction = total > 0 ? e.total / total : 0
    const length = Math.max(circumference * fraction - gap, 0)
    const offset = -cumulativeOffset
    cumulativeOffset += circumference * fraction
    return { ...e, length, offset }
  })

  const segments = total > 0
    ? slices.map((s) => ({ key: s.categoryId ?? 'uncategorized', length: s.length, offset: s.offset, color: s.color }))
    : []

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <DonutChart
        size={size}
        strokeWidth={strokeWidth}
        segments={segments}
        style={{ flexShrink: 0 }}
        centerContent={
          <>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(currency, total)}</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>spent</span>
          </>
        }
      />

      {entries.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No categorized spending this month.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((e) => (
            <div key={e.categoryId ?? 'uncategorized'} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: e.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {e.name} <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(currency, e.total)}</strong>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
