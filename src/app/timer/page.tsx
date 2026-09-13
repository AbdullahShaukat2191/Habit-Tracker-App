'use client'
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval } from 'date-fns'
import { Play, Pause, Square, Pencil, Trash2 } from 'lucide-react'
import { useTimerStore } from '@/lib/store/timerStore'
import { useProjectStore } from '@/lib/store/projectStore'
import { CURRENCIES, DEFAULT_CURRENCY, getCurrencySymbol, formatCurrency, type CurrencyCode } from '@/lib/currency'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { InvoiceModal } from '@/components/timer/InvoiceModal'
import type { TimerSession, Project } from '@shared/types'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

// A running session's contribution keeps ticking up live; paused/stopped sessions
// are already frozen at their stored totalElapsed.
function sessionElapsedNow(session: TimerSession, now: number): number {
  if (session.status === 'running') return session.totalElapsed + (now - session.startedAt)
  return session.totalElapsed
}

const primaryButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 24px', borderRadius: 8, border: 'none',
  backgroundColor: 'var(--accent)', color: '#ffffff',
  fontSize: 15, fontWeight: 500, cursor: 'pointer',
  transition: 'opacity 150ms',
}

const secondaryButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border-subtle)',
  backgroundColor: 'transparent', color: 'var(--text-secondary)',
  fontSize: 15, fontWeight: 500, cursor: 'pointer',
  transition: 'background-color 150ms',
}

const selectStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)', borderRadius: 8, backgroundColor: 'var(--bg-surface)',
  padding: '8px 12px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer',
}

type SessionFilter = 'all' | 'week' | 'month'

export default function TimerPage() {
  const { sessions, activeSession, settings, loadSessions, loadActiveSession, loadSettings, createSession, pauseSession, resumeSession, stopSession, renameSession, deleteSession, updateSettings } = useTimerStore()
  const { projects, loadProjects } = useProjectStore()

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [sessionNameInput, setSessionNameInput] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [hourlyRateInput, setHourlyRateInput] = useState('')
  const [hourlyRateSeeded, setHourlyRateSeeded] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('week')
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null)
  const [showInvoice, setShowInvoice] = useState(false)

  useEffect(() => {
    loadSessions()
    loadActiveSession()
    loadSettings()
    loadProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Seed the local hourly-rate input from the store exactly once, when settings first load —
  // afterward this input is fully local so a store round-trip mid-typing can't clobber a
  // partially-typed decimal (e.g. "1.").
  useEffect(() => {
    if (settings && !hourlyRateSeeded) {
      setHourlyRateInput(String(settings.hourlyRate))
      setHourlyRateSeeded(true)
    }
  }, [settings, hourlyRateSeeded])

  useEffect(() => {
    if (activeSession?.status !== 'running') return
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [activeSession?.status, activeSession?.id, activeSession?.startedAt])

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  const elapsedMs = useMemo(() => {
    if (!activeSession) return 0
    if (activeSession.status === 'running') {
      return activeSession.totalElapsed + (now - activeSession.startedAt)
    }
    return activeSession.totalElapsed
  }, [activeSession, now])

  const filteredSortedSessions = useMemo(() => {
    let list = sessions
    if (sessionFilter !== 'all') {
      const reference = new Date()
      const interval = sessionFilter === 'week'
        ? { start: startOfWeek(reference), end: endOfWeek(reference) }
        : { start: startOfMonth(reference), end: endOfMonth(reference) }
      list = list.filter((s) => isWithinInterval(new Date(s.createdAt), interval))
    }
    return [...list].sort((a, b) => {
      const aActive = a.status !== 'stopped'
      const bActive = b.status !== 'stopped'
      if (aActive !== bActive) return aActive ? -1 : 1
      return b.createdAt - a.createdAt
    })
  }, [sessions, sessionFilter])

  // Full sessions array, not the filtered/visible list — selections must survive a filter-tab change.
  const selectedSessions = useMemo(
    () => sessions.filter((s) => selectedSessionIds.includes(s.id)),
    [sessions, selectedSessionIds]
  )

  // Stats bar totals — independent of the filter tabs above, always Today/This Week/This Month.
  const todayTotalMs = useMemo(() => {
    const reference = new Date()
    const interval = { start: startOfDay(reference), end: endOfDay(reference) }
    return sessions
      .filter((s) => isWithinInterval(new Date(s.createdAt), interval))
      .reduce((sum, s) => sum + sessionElapsedNow(s, now), 0)
  }, [sessions, now])

  const weekTotalMs = useMemo(() => {
    const reference = new Date()
    const interval = { start: startOfWeek(reference, { weekStartsOn: 1 }), end: endOfWeek(reference, { weekStartsOn: 1 }) }
    return sessions
      .filter((s) => isWithinInterval(new Date(s.createdAt), interval))
      .reduce((sum, s) => sum + sessionElapsedNow(s, now), 0)
  }, [sessions, now])

  const monthTotalMs = useMemo(() => {
    const reference = new Date()
    const interval = { start: startOfMonth(reference), end: endOfMonth(reference) }
    return sessions
      .filter((s) => isWithinInterval(new Date(s.createdAt), interval))
      .reduce((sum, s) => sum + sessionElapsedNow(s, now), 0)
  }, [sessions, now])

  const earningsThisWeek = useMemo(
    () => (weekTotalMs / 3600000) * (settings?.hourlyRate ?? 0),
    [weekTotalMs, settings?.hourlyRate]
  )

  const handleHourlyRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setHourlyRateInput(val)
    const parsed = parseFloat(val)
    if (!isNaN(parsed) && settings) {
      updateSettings(parsed, settings.currency)
    }
  }, [settings, updateSettings])

  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    if (settings) updateSettings(settings.hourlyRate, e.target.value)
  }, [settings, updateSettings])

  const handleStart = useCallback(async () => {
    if (!selectedProjectId) return
    await createSession(selectedProjectId, sessionNameInput.trim() || undefined)
    setSessionNameInput('')
  }, [selectedProjectId, sessionNameInput, createSession])

  const handlePause = useCallback(() => { if (activeSession) pauseSession(activeSession.id) }, [activeSession, pauseSession])
  const handleResume = useCallback(() => { if (activeSession) resumeSession(activeSession.id) }, [activeSession, resumeSession])
  const handleStop = useCallback(() => { if (activeSession) stopSession(activeSession.id) }, [activeSession, stopSession])

  const handleContinue = useCallback((session: TimerSession) => {
    createSession(session.projectId, session.name ?? undefined)
  }, [createSession])

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedSessionIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }, [])

  const handleRequestDelete = useCallback((id: string) => setDeletePendingId(id), [])
  const handleCancelDelete = useCallback(() => setDeletePendingId(null), [])
  const handleConfirmDelete = useCallback(async () => {
    if (!deletePendingId) return
    await deleteSession(deletePendingId)
    setSelectedSessionIds((prev) => prev.filter((x) => x !== deletePendingId))
    setDeletePendingId(null)
  }, [deletePendingId, deleteSession])

  const isPaused = activeSession?.status === 'paused'
  const isRunning = activeSession?.status === 'running'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-base)', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Timer</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Hourly Rate</span>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{getCurrencySymbol(settings?.currency)}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={hourlyRateInput}
              onChange={handleHourlyRateChange}
              style={{
                width: 90, border: '1px solid var(--border-subtle)', borderRadius: 8,
                backgroundColor: 'var(--bg-surface)', padding: '6px 10px', fontSize: 13,
                color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <select value={settings?.currency ?? DEFAULT_CURRENCY} onChange={handleCurrencyChange} style={{ ...selectStyle, padding: '6px 10px', fontSize: 13 }}>
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                <option key={code} value={code}>{code} ({CURRENCIES[code].prefix.trim()})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
        {/* Active Timer section */}
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 32, marginBottom: 32, textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
            <select
              value={activeSession ? activeSession.projectId : selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={!!activeSession}
              style={{ ...selectStyle, minWidth: 200, opacity: activeSession ? 0.7 : 1 }}
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="What are you working on?"
              value={activeSession ? (activeSession.name ?? '') : sessionNameInput}
              onChange={(e) => setSessionNameInput(e.target.value)}
              disabled={!!activeSession}
              style={{
                minWidth: 240, border: '1px solid var(--border-subtle)', borderRadius: 8,
                backgroundColor: 'var(--bg-surface)', padding: '8px 12px', fontSize: 14,
                color: 'var(--text-primary)', outline: 'none', opacity: activeSession ? 0.7 : 1,
              }}
            />
          </div>

          <div
            className={isPaused ? 'animate-pulse' : ''}
            style={{
              fontSize: 64, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              color: activeSession ? 'var(--text-primary)' : 'var(--text-tertiary)',
              marginBottom: 24, letterSpacing: '0.02em',
            }}
          >
            {formatElapsed(elapsedMs)}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {!activeSession && (
              <button
                onClick={handleStart}
                disabled={!selectedProjectId}
                style={{ ...primaryButtonStyle, opacity: !selectedProjectId ? 0.5 : 1, cursor: !selectedProjectId ? 'not-allowed' : 'pointer' }}
              >
                <Play size={16} /> Start
              </button>
            )}
            {isRunning && (
              <>
                <button onClick={handlePause} style={primaryButtonStyle}>
                  <Pause size={16} /> Pause
                </button>
                <button onClick={handleStop} style={secondaryButtonStyle}>
                  <Square size={16} /> Stop
                </button>
              </>
            )}
            {isPaused && (
              <>
                <button onClick={handleResume} style={primaryButtonStyle}>
                  <Play size={16} /> Resume
                </button>
                <button onClick={handleStop} style={secondaryButtonStyle}>
                  <Square size={16} /> Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <StatCard label="Today" value={formatElapsed(todayTotalMs)} />
          <StatCard label="This Week" value={formatElapsed(weekTotalMs)} />
          <StatCard label="This Month" value={formatElapsed(monthTotalMs)} />
          <StatCard label="Earnings This Week" value={formatCurrency(settings?.currency, earningsThisWeek)} />
        </div>

        {/* Sessions list */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Sessions
            </h3>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'week', 'month'] as SessionFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setSessionFilter(f)}
                  style={{
                    padding: '4px 10px', borderRadius: 6,
                    border: `1px solid ${sessionFilter === f ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    backgroundColor: sessionFilter === f ? 'var(--accent-soft)' : 'transparent',
                    color: sessionFilter === f ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 12, cursor: 'pointer', transition: 'all 150ms',
                  }}
                >
                  {f === 'all' ? 'All' : f === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>
          </div>

          {selectedSessions.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={() => setShowInvoice(true)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-subtle)',
                  backgroundColor: 'transparent', color: 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                Calculate Total ({selectedSessions.length} sessions)
              </button>
            </div>
          )}

          {sessions.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
              No sessions yet. Select a project and start tracking.
            </div>
          ) : filteredSortedSessions.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
              No sessions this {sessionFilter === 'month' ? 'month' : 'week'}
            </div>
          ) : (
            filteredSortedSessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                project={projectMap.get(session.projectId)}
                isSelected={selectedSessionIds.includes(session.id)}
                onToggleSelect={handleToggleSelect}
                onContinue={handleContinue}
                onRename={renameSession}
                onDeleteRequest={handleRequestDelete}
                hourlyRate={settings?.hourlyRate ?? 0}
                currency={settings?.currency}
              />
            ))
          )}
        </div>
      </div>

      {deletePendingId && (
        <ConfirmDeleteModal
          title="Delete Session?"
          message="This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {showInvoice && (
        <InvoiceModal
          sessions={selectedSessions}
          hourlyRate={settings?.hourlyRate ?? 0}
          currency={settings?.currency}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 0', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 16px' }}>
      <div style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}

function SessionRow({
  session,
  project,
  isSelected,
  onToggleSelect,
  onContinue,
  onRename,
  onDeleteRequest,
  hourlyRate,
  currency,
}: {
  session: TimerSession
  project?: Project
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onContinue: (session: TimerSession) => void
  onRename: (id: string, name: string) => void
  onDeleteRequest: (id: string) => void
  hourlyRate: number
  currency: string | undefined
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(session.name ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  const isActive = session.status !== 'stopped'
  const isRunning = session.status === 'running'

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

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 10, padding: '12px 16px', marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      {!isActive && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(session.id)}
          style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
        />
      )}

      {isActive && (
        <span
          className={isRunning ? 'animate-pulse' : ''}
          style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            backgroundColor: isRunning ? '#4ADE80' : '#FBBF24',
          }}
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
              width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-subtle)',
              borderRadius: 6, backgroundColor: 'var(--bg-surface)', padding: '2px 6px',
              fontSize: 14, color: 'var(--text-primary)', outline: 'none',
            }}
          />
        ) : (
          <div style={{ fontSize: 14, fontWeight: 500, color: session.name ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
            {session.name || 'Unnamed Session'}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {project && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: project.color, flexShrink: 0 }} />}
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{project ? project.name : 'Unknown Project'}</span>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {formatElapsed(session.totalElapsed)}
          </span>
          {!isActive && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {formatCurrency(currency, (session.totalElapsed / 3600000) * hourlyRate)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {format(new Date(session.createdAt), 'EEE MMM d, h:mm a')}
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
