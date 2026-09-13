'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { TimerSession } from '@shared/types'

const RECEIPT_WIDTH = 380
const TOOTH_WIDTH = 18
const TOOTH_HEIGHT = 11
const CORNER_CHAMFER = 5

const RECEIPT_TEXT = '#1a1a1a'
const RECEIPT_MUTED = '#6b6b6b'
const RECEIPT_HAIRLINE = '#d4d4d4'
const MONO_FONT = "'Courier New', Courier, monospace"

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

// Deterministic sawtooth polygon along the bottom edge (a CSS mask/gradient approach
// is fragile to get pixel-perfect for an arbitrary content height; computing exact
// triangle points from the box's own measured height is not). The top-left/top-right
// corners get a small diagonal chamfer standing in for a true rounded corner, since
// clip-path polygons can only express straight lines, not arcs.
function buildZigzagClipPath(width: number, height: number): string {
  if (height <= TOOTH_HEIGHT) return 'none'
  const baseY = height - TOOTH_HEIGHT
  const numTeeth = Math.max(1, Math.round(width / TOOTH_WIDTH))
  const toothWidth = width / numTeeth

  const points: string[] = [
    `${CORNER_CHAMFER}px 0`,
    `${width - CORNER_CHAMFER}px 0`,
    `${width}px ${CORNER_CHAMFER}px`,
    `${width}px ${baseY}px`,
  ]
  for (let i = 0; i < numTeeth; i++) {
    const xRight = width - i * toothWidth
    const xMid = xRight - toothWidth / 2
    const xLeft = xRight - toothWidth
    points.push(`${xMid}px ${height}px`)
    points.push(`${xLeft}px ${baseY}px`)
  }
  points.push(`0 ${CORNER_CHAMFER}px`)

  return `polygon(${points.join(', ')})`
}

interface InvoiceModalProps {
  sessions: TimerSession[]
  currency: string | undefined
  onClose: () => void
}

export function InvoiceModal({ sessions, currency, onClose }: InvoiceModalProps) {
  // Measures the outer box itself (not the padded inner content div) — clip-path is
  // applied to this box's own border-box, and it carries no padding/border of its own,
  // so its content-box height (what ResizeObserver reports by default) equals the
  // full rendered height the zigzag needs to match.
  const boxRef = useRef<HTMLDivElement>(null)
  const [boxHeight, setBoxHeight] = useState(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      setBoxHeight(entries[0].contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const totalElapsedMs = useMemo(() => sessions.reduce((sum, s) => sum + s.totalElapsed, 0), [sessions])
  const totalAmount = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.totalElapsed / 3600000) * s.rateSnapshot, 0),
    [sessions]
  )
  const clipPath = useMemo(() => buildZigzagClipPath(RECEIPT_WIDTH, boxHeight), [boxHeight])

  // Every selected session shares one rate → show a single summary "Hourly Rate" line.
  // Rates differ → drop that line and show each line item's own rate instead.
  const rates = useMemo(() => new Set(sessions.map((s) => s.rateSnapshot)), [sessions])
  const uniformRate = rates.size === 1 ? sessions[0]?.rateSnapshot ?? null : null

  const hairline = <div style={{ borderTop: `1px solid ${RECEIPT_HAIRLINE}`, margin: '10px 0' }} />

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)', padding: 24,
      }}
    >
      <motion.div
        ref={boxRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'relative', width: RECEIPT_WIDTH,
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
          clipPath,
          WebkitClipPath: clipPath,
        }}
      >
        <div style={{ padding: '28px 24px 44px', color: RECEIPT_TEXT, fontFamily: 'system-ui, sans-serif' }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: 12, right: 12, background: 'none', border: 'none',
              cursor: 'pointer', color: RECEIPT_MUTED, padding: 4, display: 'flex',
            }}
          >
            <X size={18} />
          </button>

          <h2 style={{ margin: 0, textAlign: 'center', fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', color: RECEIPT_TEXT }}>
            INVOICE
          </h2>

          {hairline}

          <div style={{ textAlign: 'center', fontSize: 13, color: RECEIPT_MUTED }}>
            {format(new Date(), 'dd/MM/yyyy')}
          </div>

          {hairline}

          <div style={{ margin: '12px 0' }}>
            {sessions.map((session) => {
              const amount = (session.totalElapsed / 3600000) * session.rateSnapshot
              return (
                <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                    {session.name || 'Unnamed Session'}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: MONO_FONT, fontSize: 14, fontWeight: 600 }}>
                      {formatCurrency(currency, amount)}
                    </div>
                    <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: RECEIPT_MUTED, marginTop: 2 }}>
                      {formatElapsed(session.totalElapsed)}
                    </div>
                    {uniformRate === null && (
                      <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: RECEIPT_MUTED, marginTop: 2 }}>
                        {formatCurrency(currency, session.rateSnapshot)}/hr
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {hairline}

          <div style={{ textAlign: 'right', fontSize: 13, margin: '8px 0' }}>
            Total Hours: <span style={{ fontFamily: MONO_FONT }}>{formatElapsed(totalElapsedMs)}</span>
          </div>
          {uniformRate !== null && (
            <div style={{ textAlign: 'right', fontSize: 13, margin: '8px 0' }}>
              Hourly Rate: <span style={{ fontFamily: MONO_FONT }}>{formatCurrency(currency, uniformRate)}</span>
            </div>
          )}

          <div style={{ borderTop: `3px double ${RECEIPT_TEXT}`, margin: '12px 0' }} />

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 16, fontWeight: 700, marginRight: 8 }}>Total:</span>
            <span style={{ fontFamily: MONO_FONT, fontSize: 22, fontWeight: 800 }}>{formatCurrency(currency, totalAmount)}</span>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: RECEIPT_MUTED, letterSpacing: '4px' }}>
            Thank You
          </div>
        </div>
      </motion.div>
    </div>
  )
}
