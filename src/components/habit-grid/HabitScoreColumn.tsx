'use client'
import React from 'react'

interface HabitScoreColumnProps {
  completed: number
  total: number
  streak: number
}

const HabitScoreColumnInner = ({ completed, total, streak }: HabitScoreColumnProps) => {
  return (
    <div
      className="tabular"
      style={{
        minWidth: 100,
        paddingLeft: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 14,
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ minWidth: 52, textAlign: 'right', display: 'inline-block' }}>
        {completed}/{total}
      </span>
      <span
        role="text"
        aria-label={`streak: ${streak} days`}
        style={{ color: streak > 0 ? '#F97316' : 'var(--text-tertiary)' }}
      >
        🔥{streak}
      </span>
    </div>
  )
}

export const HabitScoreColumn = React.memo(HabitScoreColumnInner)
HabitScoreColumn.displayName = 'HabitScoreColumn'
