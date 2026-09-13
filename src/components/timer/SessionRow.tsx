'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { isSameDay } from 'date-fns'
import { Play, Pencil, Trash2 } from 'lucide-react'
import { formatElapsed, formatSessionTimestamp } from '@/lib/timerFormat'
import { formatCurrency } from '@/lib/currency'
import type { TimerSession, TimerSegment, Project } from '@shared/types'

export interface SessionRowProps {
  session: TimerSession
  project?: Project
  segments?: TimerSegment[]
  onContinue: (session: TimerSession) => void
  onRename: (id: string, name: string) => void
  onDeleteRequest: (id: string) => void
  currency?: string
  // Optional selection checkbox — only ever shown for stopped sessions. Recent Sessions
  // (Task 7) omits/sets this false; the Sessions tab (Task 9) sets it true.
  selectable?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}

export function SessionRow({
  session,
  project,
  segments = [],
  onContinue,
  onRename,
  onDeleteRequest,
  currency,
  selectable = false,
  isSelected = false,
  onToggleSelect,
}: SessionRowProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(session.name ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  const isActive = session.status !== 'stopped'

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const startEdit = useCallback(() => {
    setDraft(session.name ?? '')
    setIsEditing(true)
  }, [session.name])

  const commitEdit = useCallback(() => {
    setIsEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== (session.name ?? '')) onRename(session.id, trimmed)
  }, [draft, session.id, session.name, onRename])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setDraft(session.name ?? '')
  }, [session.name])

  const actionButtonStyle: React.CSSProperties = {
    background: 'none', border: 'none', padding: 4, cursor: 'pointer',
    color: 'var(--text-tertiary)', opacity: isHovered ? 1 : 0,
    transition: 'opacity 150ms, color 150ms', display: 'flex',
    alignItems: 'center', justifyContent: 'center', borderRadius: 4, flexShrink: 0,
  }

  // From/To timestamps derived from the session's work segments (falling back to the
  // session's own startedAt/stoppedAt when no segments were recorded).
  const firstStart = segments[0]?.startedAt ?? session.startedAt
  const lastEnd = session.status !== 'stopped' ? null : (segments[segments.length - 1]?.endedAt ?? session.stoppedAt)
  const spansMultipleDays = !isSameDay(firstStart, lastEnd ?? Date.now())
  const fromLabel = formatSessionTimestamp(firstStart, spansMultipleDays)
  const toLabel = session.status === 'running'
    ? 'Running'
    : session.status === 'paused'
      ? 'Paused'
      : formatSessionTimestamp(lastEnd!, spansMultipleDays)

  const earnings = (session.totalElapsed / 3600000) * session.rateSnapshot

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: isActive ? 'var(--accent-soft)' : 'var(--bg-surface)',
        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-subtle)'}`,
        borderRadius: 10, padding: '12px 16px', marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      {selectable && !isActive && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect?.(session.id)}
          style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
        />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit()
              else if (e.key === 'Escape') cancelEdit()
            }}
            style={{
              width: '100%', boxSizing: 'border-box', border: '1px solid var(--timer-input-border)',
              borderRadius: 6, backgroundColor: 'var(--bg-surface)', padding: `2px 6px 2px ${project ? 14 : 0}px`,
              fontSize: 14, color: 'var(--text-primary)', outline: 'none',
            }}
          />
        ) : (
          <div style={{ fontSize: 14, fontWeight: 500, paddingLeft: project ? 14 : 0, color: session.name ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
            {session.name || 'Unnamed Session'}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {project && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: project.color, flexShrink: 0 }} />}
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{project ? project.name : 'Unknown Project'}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {fromLabel} – {toLabel}
        </div>
        {segments.length > 1 && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {segments.length} work periods
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
          {formatElapsed(session.totalElapsed)}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(currency, earnings)}
        </div>
      </div>

      {!isEditing && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {!isActive && (
            <button
              onClick={() => onContinue(session)}
              title="Continue this session"
              style={actionButtonStyle}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <Play size={14} />
            </button>
          )}
          <button
            onClick={startEdit}
            title="Rename session"
            style={actionButtonStyle}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            <Pencil size={14} />
          </button>
          {!isActive && (
            <button
              onClick={() => onDeleteRequest(session.id)}
              title="Delete session"
              style={actionButtonStyle}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
