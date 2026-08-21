'use client'
import React from 'react'

export interface DonutChartSegment {
  key: string
  length: number
  offset: number
  color: string
}

interface DonutChartProps {
  size: number
  strokeWidth: number
  segments: DonutChartSegment[]
  centerContent: React.ReactNode
  style?: React.CSSProperties
}

export function DonutChart({ size, strokeWidth, segments, centerContent, style }: DonutChartProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={strokeWidth} />
          {segments.map((s) => (
            <circle
              key={s.key}
              cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke={s.color} strokeWidth={strokeWidth} strokeLinecap="round"
              strokeDasharray={`${s.length} ${circumference - s.length}`}
              strokeDashoffset={s.offset}
            />
          ))}
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {centerContent}
      </div>
    </div>
  )
}
