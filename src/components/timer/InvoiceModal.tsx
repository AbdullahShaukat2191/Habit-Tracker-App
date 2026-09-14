'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { TimerSession } from '@shared/types'

const RECEIPT_WIDTH = 380
const TOOTH_WIDTH = 18
const TOOTH_HEIGHT = 11
const CORNER_CHAMFER = 5
const PAGE_SIZE = 4

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

// The 3-button window always starts at `current` (1 2 3 on page 1, 2 3 4 on
// page 2, ...), except near the end where it clamps so the final window
// always shows the last three pages instead of running past `total`.
function getPageWindow(current: number, total: number): number[] {
  const size = Math.min(3, total)
  let start = current
  if (start + size - 1 > total) start = total - size + 1
  start = Math.max(1, start)
  return Array.from({ length: size }, (_, i) => start + i)
}

interface LineItemProps {
  session: TimerSession
  currency: string | undefined
  showRate: boolean
  hidden?: boolean
}

function LineItem({ session, currency, showRate, hidden }: LineItemProps) {
  const amount = (session.totalElapsed / 3600000) * session.rateSnapshot
  return (
    <div
      aria-hidden={hidden || undefined}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
        marginBottom: 10, visibility: hidden ? 'hidden' : 'visible',
      }}
    >
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
        {showRate && (
          <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: RECEIPT_MUTED, marginTop: 2 }}>
            {formatCurrency(currency, session.rateSnapshot)}/hr
          </div>
        )}
      </div>
    </div>
  )
}

interface PaginationControlProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

function PaginationControl({ page, totalPages, onChange }: PaginationControlProps) {
  const pageWindow = getPageWindow(page, totalPages)
  const plainButtonStyle: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 6, border: `1px solid ${RECEIPT_HAIRLINE}`,
    backgroundColor: '#ffffff', color: RECEIPT_TEXT, fontSize: 12, fontFamily: MONO_FONT,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
  }
  const activeButtonStyle: React.CSSProperties = {
    ...plainButtonStyle, backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#ffffff', fontWeight: 700,
  }
  const disabledChevronStyle: React.CSSProperties = {
    ...plainButtonStyle, color: RECEIPT_MUTED, opacity: 0.4, cursor: 'default',
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, margin: '12px 0' }}>
      <button
        aria-label="Previous page"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        style={page === 1 ? disabledChevronStyle : plainButtonStyle}
      >
        <ChevronLeft size={14} />
      </button>
      {pageWindow.map((p) => (
        <button
          key={p}
          aria-label={`Page ${p}`}
          aria-current={p === page || undefined}
          onClick={() => onChange(p)}
          style={p === page ? activeButtonStyle : plainButtonStyle}
        >
          {p}
        </button>
      ))}
      <button
        aria-label="Next page"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        style={page === totalPages ? disabledChevronStyle : plainButtonStyle}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
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
  const [page, setPage] = useState(1)

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

  const isPaginated = sessions.length > PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

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

          {isPaginated && (
            <PaginationControl page={currentPage} totalPages={totalPages} onChange={setPage} />
          )}

          {isPaginated ? (
            <div style={{ overflow: 'hidden', margin: '12px 0' }}>
              <div
                style={{
                  display: 'flex',
                  transform: `translateX(-${(currentPage - 1) * 100}%)`,
                  transition: 'transform 200ms ease-out',
                }}
              >
                {Array.from({ length: totalPages }, (_, pageIndex) => {
                  const start = pageIndex * PAGE_SIZE
                  const pageSessions = sessions.slice(start, start + PAGE_SIZE)
                  const placeholderCount = PAGE_SIZE - pageSessions.length
                  return (
                    <div key={pageIndex} style={{ flex: '0 0 100%', minWidth: '100%' }}>
                      {pageSessions.map((session) => (
                        <LineItem key={session.id} session={session} currency={currency} showRate={uniformRate === null} />
                      ))}
                      {Array.from({ length: placeholderCount }, (_, i) => (
                        <LineItem
                          key={`placeholder-${i}`}
                          session={pageSessions[0] ?? sessions[0]}
                          currency={currency}
                          showRate={uniformRate === null}
                          hidden
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ margin: '12px 0' }}>
              {sessions.map((session) => (
                <LineItem key={session.id} session={session} currency={currency} showRate={uniformRate === null} />
              ))}
            </div>
          )}

          {hairline}

          <div style={{ textAlign: 'right', fontSize: 13, margin: '8px 0' }}>
            Total Hours: <span style={{ fontFamily: MONO_FONT }}>{formatElapsed(totalElapsedMs)}</span>
          </div>
          {uniformRate !== null && (
            <div style={{ textAlign: 'right', fontSize: 13, margin: '8px 0' }}>
              Hourly Rate: <span style={{ fontFamily: MONO_FONT }}>{formatCurrency(currency, uniformRate)}</span>
            </div>
          )}

          <div style={{ borderTop: `3px double ${RECEIPT_TEXT}`, margin: '12px 0 16px' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, color: RECEIPT_MUTED }}>
              Page {currentPage}/{totalPages}
            </span>
            <span>
              <span style={{ fontSize: 16, fontWeight: 700, marginRight: 8 }}>Total:</span>
              <span style={{ fontFamily: MONO_FONT, fontSize: 22, fontWeight: 800 }}>{formatCurrency(currency, totalAmount)}</span>
            </span>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: RECEIPT_MUTED, letterSpacing: '4px' }}>
            Thank You
          </div>
        </div>
      </motion.div>
    </div>
  )
}
