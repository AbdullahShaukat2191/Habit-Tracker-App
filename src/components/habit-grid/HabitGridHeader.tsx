'use client'
import React from 'react'
import { NAME_COL_WIDTH } from './constants'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

interface HabitGridHeaderProps {
  daysInMonth: number
  currentMonth: string
  today: string
  perfectDays: Set<string>
}

const HabitGridHeaderInner = ({ daysInMonth, currentMonth, today, perfectDays }: HabitGridHeaderProps) => {
  const days: React.ReactNode[] = []

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentMonth}-${String(d).padStart(2, '0')}`
    const isToday = dateStr === today
    const isPerfect = perfectDays.has(dateStr)
    const dow = DOW[new Date(`${dateStr}T12:00:00`).getDay()]

    const bgColor = isPerfect ? '#EA580C' : isToday ? 'var(--accent)' : 'transparent'
    const numColor = isPerfect || isToday ? '#FFFFFF' : 'var(--text-tertiary)'
    const dowColor = isPerfect ? 'rgba(255,255,255,0.8)' : isToday ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)'

    days.push(
      <div
        key={d}
        style={{
          width: 'var(--cell-size)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          backgroundColor: bgColor,
          borderRadius: 4,
          paddingTop: 2,
          paddingBottom: 2,
          transition: 'background-color 300ms',
        }}
      >
        {isPerfect ? (
          <span style={{ fontSize: 11, lineHeight: 1.2 }}>🔥</span>
        ) : (
          <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: numColor, lineHeight: 1.2 }}>
            {d}
          </span>
        )}
        <span style={{ fontSize: 10, color: dowColor, opacity: isPerfect || isToday ? 1 : 0.65, lineHeight: 1, letterSpacing: '0.02em' }}>
          {dow}
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        backgroundColor: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        paddingBottom: 6,
        borderBottom: '1px solid var(--border-strong)',
      }}
    >
      <div
        style={{
          width: NAME_COL_WIDTH,
          minWidth: NAME_COL_WIDTH,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Habit
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        {days}
      </div>

      <div
        style={{
          minWidth: 100,
          paddingLeft: 12,
          fontSize: 11,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}
      >
        Score
      </div>
    </div>
  )
}

export const HabitGridHeader = React.memo(HabitGridHeaderInner)
HabitGridHeader.displayName = 'HabitGridHeader'
