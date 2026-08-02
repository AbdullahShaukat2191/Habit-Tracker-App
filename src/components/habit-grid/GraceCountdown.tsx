'use client'
import React, { useEffect, useState } from 'react'
import { getGraceRemainingMs } from '@shared/backfillLogic'

interface GraceCountdownProps {
  month: string
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function GraceCountdown({ month }: GraceCountdownProps) {
  const [remaining, setRemaining] = useState(() => getGraceRemainingMs(month))

  useEffect(() => {
    setRemaining(getGraceRemainingMs(month))
    const id = setInterval(() => setRemaining(getGraceRemainingMs(month)), 1000)
    return () => clearInterval(id)
  }, [month])

  if (remaining <= 0) {
    return <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Past month — read only</div>
  }

  return (
    <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
      Editable for{' '}
      <span
        style={{
          fontFamily: 'monospace',
          fontWeight: 700,
          color: '#F87171',
          letterSpacing: '0.05em',
        }}
      >
        {formatRemaining(remaining)}
      </span>
    </div>
  )
}
