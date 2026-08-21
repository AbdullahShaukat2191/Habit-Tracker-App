'use client'
import React, { useState } from 'react'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { SETTING_KEYS } from '@shared/types'
import { formatCurrency } from '@/lib/currency'

interface WeeklySpendingChartProps {
  data: number[] // 7 entries, Monday..Sunday
}

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WIDTH = 460
const HEIGHT = 180
const PADDING = { top: 12, right: 12, bottom: 24, left: 48 }
const BAR_RADIUS = 4
const MAX_BAR_WIDTH = 24

function topRoundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, height, width / 2)
  return `
    M ${x} ${y + height}
    L ${x} ${y + r}
    Q ${x} ${y} ${x + r} ${y}
    L ${x + width - r} ${y}
    Q ${x + width} ${y} ${x + width} ${y + r}
    L ${x + width} ${y + height}
    Z
  `
}

export function WeeklySpendingChart({ data }: WeeklySpendingChartProps) {
  const currency = useSettingsStore((s) => s.get(SETTING_KEYS.FINANCE_CURRENCY))
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const maxValue = Math.max(1, ...data)
  const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxValue)) - 1))
  const axisMax = Math.ceil(maxValue / step) * step || 1

  const slotWidth = plotWidth / 7
  const barWidth = Math.min(MAX_BAR_WIDTH, slotWidth * 0.6)

  const gridLines = [0, 0.5, 1].map((f) => ({
    y: PADDING.top + plotHeight * (1 - f),
    value: Math.round(axisMax * f),
  }))

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: 'block' }}>
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={g.y} y2={g.y} stroke="var(--border-subtle)" strokeWidth={1} />
            <text x={PADDING.left - 8} y={g.y + 4} fontSize={10} fill="var(--text-tertiary)" textAnchor="end">
              {g.value >= 1000 ? `${Math.round(g.value / 1000)}k` : g.value}
            </text>
          </g>
        ))}

        {data.map((value, i) => {
          const slotCenter = PADDING.left + slotWidth * (i + 0.5)
          const barHeight = (value / axisMax) * plotHeight
          const barX = slotCenter - barWidth / 2
          const barY = PADDING.top + plotHeight - barHeight
          const isHovered = hoverIndex === i

          return (
            <g key={i}>
              <path
                d={topRoundedRectPath(barX, barY, barWidth, Math.max(barHeight, 1), BAR_RADIUS)}
                fill="var(--accent)"
                opacity={isHovered ? 0.85 : 1}
              />
              <rect
                x={slotCenter - slotWidth / 2} y={PADDING.top} width={slotWidth} height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{ cursor: 'pointer' }}
              />
              <text x={slotCenter} y={HEIGHT - 6} fontSize={10} fill="var(--text-tertiary)" textAnchor="middle">
                {LABELS[i]}
              </text>
            </g>
          )
        })}
      </svg>

      {hoverIndex !== null && (() => {
        const barTopY = PADDING.top + plotHeight - (data[hoverIndex] / axisMax) * plotHeight
        return (
          <div
            style={{
              position: 'absolute',
              // Both left and top are expressed as percentages of the same coordinate
              // space the SVG itself scales within (WIDTH/HEIGHT), so the tooltip stays
              // correctly positioned regardless of the container's actual rendered size —
              // never a raw viewBox-unit value used as a literal CSS pixel offset.
              left: `${((PADDING.left + slotWidth * (hoverIndex + 0.5)) / WIDTH) * 100}%`,
              top: `${(barTopY / HEIGHT) * 100}%`,
              transform: 'translate(-50%, calc(-100% - 8px))',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(currency, data[hoverIndex])}</strong>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>{LABELS[hoverIndex]}</span>
          </div>
        )
      })()}
    </div>
  )
}
