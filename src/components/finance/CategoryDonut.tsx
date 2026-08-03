'use client'
import React from 'react'
import type { CategoryBreakdownEntry } from '@shared/financeLogic'

interface CategoryDonutProps {
  entries: CategoryBreakdownEntry[]
}

export function CategoryDonut({ entries }: CategoryDonutProps) {
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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={strokeWidth} />
            {total > 0 &&
              slices.map((s) => (
                <circle
                  key={s.categoryId ?? 'uncategorized'}
                  cx={size / 2} cy={size / 2} r={radius} fill="none"
                  stroke={s.color} strokeWidth={strokeWidth} strokeLinecap="round"
                  strokeDasharray={`${s.length} ${circumference - s.length}`}
                  strokeDashoffset={s.offset}
                />
              ))}
          </g>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Rs. {total.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>spent</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No categorized spending this month.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((e) => (
            <div key={e.categoryId ?? 'uncategorized'} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: e.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {e.name} <strong style={{ color: 'var(--text-primary)' }}>Rs. {e.total.toLocaleString()}</strong>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
