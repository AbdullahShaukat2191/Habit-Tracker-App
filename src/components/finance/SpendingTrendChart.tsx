'use client'
import React, { useState, useMemo } from 'react'
import { format } from 'date-fns'

interface SpendingTrendChartProps {
  data: Array<{ month: string; total: number }>
}

const WIDTH = 460
const HEIGHT = 180
const PADDING = { top: 12, right: 12, bottom: 24, left: 48 }

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const maxValue = Math.max(1, ...data.map((d) => d.total))
  // Round the axis ceiling up to a clean step
  const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxValue)) - 1))
  const axisMax = Math.ceil(maxValue / step) * step || 1

  const points = useMemo(
    () =>
      data.map((d, i) => {
        const x = PADDING.left + (data.length === 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth)
        const y = PADDING.top + plotHeight - (d.total / axisMax) * plotHeight
        return { x, y, ...d }
      }),
    [data, plotWidth, plotHeight, axisMax]
  )

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? PADDING.left} ${PADDING.top + plotHeight} L ${points[0]?.x ?? PADDING.left} ${PADDING.top + plotHeight} Z`

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: PADDING.top + plotHeight * (1 - f),
    value: Math.round(axisMax * f),
  }))

  const hovered = hoverIndex !== null ? points[hoverIndex] : null

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

        {points.length > 1 && <path d={areaPath} fill="var(--accent)" opacity={0.1} stroke="none" />}
        {points.length > 1 && <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

        {points.map((p, i) => (
          <g key={p.month}>
            <circle cx={p.x} cy={p.y} r={5} fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth={2} />
            <circle
              cx={p.x} cy={p.y} r={12} fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: 'pointer' }}
            />
            <text x={p.x} y={HEIGHT - 6} fontSize={10} fill="var(--text-tertiary)" textAnchor="middle">
              {format(new Date(p.month + '-01T12:00:00'), 'MMM')}
            </text>
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: `${(hovered.x / WIDTH) * 100}%`,
            top: `${(hovered.y / HEIGHT) * 100}%`,
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
          <strong style={{ color: 'var(--text-primary)' }}>Rs. {hovered.total.toLocaleString()}</strong>{' '}
          <span style={{ color: 'var(--text-secondary)' }}>{format(new Date(hovered.month + '-01T12:00:00'), 'MMMM yyyy')}</span>
        </div>
      )}
    </div>
  )
}
