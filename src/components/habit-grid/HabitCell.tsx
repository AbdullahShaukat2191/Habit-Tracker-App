'use client'
import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { cellConfetti } from '@/lib/confetti'

type CellState = 'filled' | 'empty' | 'disabled'

interface HabitCellProps {
  dateStr: string
  today: string
  state: CellState
  isToday: boolean
  allowPastDays?: boolean
  onToggle: (date: string) => void
}

const HabitCellInner = ({ dateStr, today, state, isToday, allowPastDays, onToggle }: HabitCellProps) => {
  const [pulsing, setPulsing] = useState(false)
  const wasEmptyRef = useRef(false)

  const isPastDay = dateStr < today
  const isClickable = state !== 'disabled' && (isToday || (allowPastDays && isPastDay))

  const handleClick = (e?: React.MouseEvent<HTMLDivElement>) => {
    if (!isClickable) return
    wasEmptyRef.current = state === 'empty'
    if (wasEmptyRef.current && e) {
      const rect = e.currentTarget.getBoundingClientRect()
      cellConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2)
    }
    setPulsing(true)
    onToggle(dateStr)
  }

  useEffect(() => {
    if (!pulsing) return
    const id = setTimeout(() => setPulsing(false), 400)
    return () => clearTimeout(id)
  }, [pulsing])

  return (
    <div
      role={isClickable ? 'checkbox' : undefined}
      aria-checked={isClickable ? state === 'filled' : undefined}
      aria-label={dateStr}
      tabIndex={isClickable ? 0 : -1}
      onClick={(e) => handleClick(e)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          handleClick()
        }
      }}
      style={{
        width: 'var(--cell-size)',
        height: 'var(--cell-size)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isClickable ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      {/* Only animate scale — never backgroundColor.
          Animating backgroundColor leaves a stale inline style override
          that persists after the animation ends, breaking the empty state. */}
      <motion.div
        animate={pulsing ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          width: 'calc(var(--cell-size) - 6px)',
          height: 'calc(var(--cell-size) - 6px)',
          borderRadius: 4,
          background: state === 'filled'
            ? 'linear-gradient(135deg, var(--cell-filled-from), var(--cell-filled-to))'
            : state === 'disabled'
            ? 'var(--cell-disabled)'
            : 'var(--cell-empty)',
          border: state === 'empty' ? '1.5px solid var(--border-strong)' : 'none',
          boxShadow:
            pulsing
              ? '0 0 0 4px var(--accent-glow), 0 0 0 2px var(--accent-soft)'
              : state === 'filled' && isToday
              ? '0 0 8px var(--accent-glow)'
              : 'none',
        }}
      />
    </div>
  )
}

export const HabitCell = React.memo(HabitCellInner)
HabitCell.displayName = 'HabitCell'
