'use client'
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { isWithinInterval, subWeeks } from 'date-fns'
import { Play, Pause, Square } from 'lucide-react'
import { useTimerStore } from '@/lib/store/timerStore'
import { useProjectStore } from '@/lib/store/projectStore'
import { CURRENCIES, DEFAULT_CURRENCY, getCurrencySymbol, formatCurrency, type CurrencyCode } from '@/lib/currency'
import { formatElapsed, formatHoursMinutes, formatRelativeAgo, getWeekRange, sessionElapsedNow } from '@/lib/timerFormat'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { SessionRow } from '@/components/timer/SessionRow'
import { StatBar } from '@/components/timer/StatBar'
import type { TimerSession } from '@shared/types'

const DAY_MS = 24 * 60 * 60 * 1000
const RECENT_WINDOW_MS = 14 * DAY_MS

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
  border: '1px solid var(--timer-input-border)', borderRadius: 8, backgroundColor: 'var(--bg-surface)',
  padding: '8px 12px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer',
}

const rateInputStyle: React.CSSProperties = {
  width: 90, border: '1px solid var(--timer-input-border)', borderRadius: 8,
  backgroundColor: 'var(--bg-surface)', padding: '6px 10px', fontSize: 13,
  color: 'var(--text-primary)', outline: 'none',
}

export function TimerTab() {
  const {
    sessions, activeSession, settings, segmentsBySessionId,
    loadSessions, loadActiveSession, loadSettings, loadSegmentsForSessions,
    createSession, pauseSession, resumeSession, stopSession, renameSession, deleteSession,
    updateSettings, setProjectRate,
  } = useTimerStore()
  const { projects, loadProjects } = useProjectStore()

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [sessionNameInput, setSessionNameInput] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [projectRateInput, setProjectRateInput] = useState('')
  const [defaultRateInput, setDefaultRateInput] = useState('')
  const [defaultRateSeeded, setDefaultRateSeeded] = useState(false)
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null)
  const [startError, setStartError] = useState('')

  useEffect(() => {
    loadSessions()
    loadActiveSession()
    loadSettings()
    loadProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Seed the local default-rate input from the store exactly once, when settings first load —
  // afterward this input is fully local so a store round-trip mid-typing can't clobber a
  // partially-typed decimal (e.g. "1.").
  useEffect(() => {
    if (settings && !defaultRateSeeded) {
      setDefaultRateInput(String(settings.hourlyRate))
      setDefaultRateSeeded(true)
    }
  }, [settings, defaultRateSeeded])

  useEffect(() => {
    if (activeSession?.status !== 'running') return
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [activeSession?.status, activeSession?.id, activeSession?.startedAt])

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  // The project the rate editor targets: the running/paused session's project takes
  // priority (so you can see/adjust the rate for the timer that's actually active),
  // falling back to whatever's picked in the selector.
  const relevantProjectId = activeSession ? activeSession.projectId : selectedProjectId
  const relevantProject = relevantProjectId ? projectMap.get(relevantProjectId) : undefined
  const effectiveProjectRate = relevantProject ? (relevantProject.hourlyRate ?? settings?.hourlyRate ?? 0) : 0

  // Re-seed the project-rate input whenever the *target project* changes (selection change,
  // or a session starting/stopping) — not on every settings/project store round-trip, so
  // mid-typing edits aren't clobbered. Gated on `relevantProject`/`settings` actually being
  // loaded (rather than just on `relevantProjectId` changing): on a cold nav to /timer with a
  // session already running, `relevantProjectId` can flip to the real project id before
  // `loadProjects()` resolves (load order: sessions, active session, settings, projects) — if
  // we seeded unconditionally at that point, `relevantProject` would still be undefined and
  // the field would get stuck showing "0" forever, since this effect never fires again for the
  // same project id. Tracking the last-seeded project id in a ref lets the effect wait for real
  // data and seed exactly once it arrives, without re-seeding (and clobbering the user's typing)
  // on every subsequent projects/settings reload for that same project.
  const seededProjectIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!relevantProjectId) {
      seededProjectIdRef.current = null
      setProjectRateInput('')
      return
    }
    if (seededProjectIdRef.current === relevantProjectId) return
    if (!relevantProject || !settings) return // data not loaded yet — wait rather than seed a stale "0"
    setProjectRateInput(String(effectiveProjectRate))
    seededProjectIdRef.current = relevantProjectId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantProjectId, relevantProject, settings])

  const elapsedMs = useMemo(() => {
    if (!activeSession) return 0
    if (activeSession.status === 'running') {
      return activeSession.totalElapsed + (now - activeSession.startedAt)
    }
    return activeSession.totalElapsed
  }, [activeSession, now])

  // ─── Stats bar ────────────────────────────────────────────────────────────

  const last24hMs = useMemo(() => {
    const cutoff = now - DAY_MS
    return sessions
      .filter((s) => s.createdAt >= cutoff && s.createdAt <= now)
      .reduce((sum, s) => sum + sessionElapsedNow(s, now), 0)
  }, [sessions, now])

  const thisWeekMs = useMemo(() => {
    const range = getWeekRange(new Date(now))
    return sessions
      .filter((s) => isWithinInterval(new Date(s.createdAt), range))
      .reduce((sum, s) => sum + sessionElapsedNow(s, now), 0)
  }, [sessions, now])

  const lastWeekMs = useMemo(() => {
    const range = getWeekRange(subWeeks(new Date(now), 1))
    return sessions
      .filter((s) => isWithinInterval(new Date(s.createdAt), range))
      .reduce((sum, s) => sum + sessionElapsedNow(s, now), 0)
  }, [sessions, now])

  const sinceStartMs = useMemo(
    () => sessions.reduce((sum, s) => sum + sessionElapsedNow(s, now), 0),
    [sessions, now]
  )

  const lastActivityAt = useMemo(() => {
    if (sessions.length === 0) return null
    return Math.max(...sessions.map((s) => (s.status === 'stopped' ? (s.stoppedAt ?? s.createdAt) : now)))
  }, [sessions, now])

  // ─── Recent sessions (14-day window) ─────────────────────────────────────

  const recentSessions = useMemo(() => {
    const cutoff = now - RECENT_WINDOW_MS
    return sessions
      .filter((s) => s.createdAt >= cutoff)
      .sort((a, b) => {
        const aActive = a.status !== 'stopped'
        const bActive = b.status !== 'stopped'
        if (aActive !== bActive) return aActive ? -1 : 1
        return b.createdAt - a.createdAt
      })
  }, [sessions, now])

  const visibleSessionIdsKey = useMemo(() => recentSessions.map((s) => s.id).join(','), [recentSessions])

  useEffect(() => {
    if (visibleSessionIdsKey) loadSegmentsForSessions(visibleSessionIdsKey.split(','))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSessionIdsKey])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    const trimmedName = sessionNameInput.trim()
    if (!selectedProjectId || !trimmedName) {
      setStartError('Please select a project and enter a session name.')
      return
    }
    setStartError('')
    await createSession(selectedProjectId, trimmedName)
    setSessionNameInput('')
  }, [selectedProjectId, sessionNameInput, createSession])

  const handlePause = useCallback(() => { if (activeSession) pauseSession(activeSession.id) }, [activeSession, pauseSession])
  const handleResume = useCallback(() => { if (activeSession) resumeSession(activeSession.id) }, [activeSession, resumeSession])
  const handleStop = useCallback(() => { if (activeSession) stopSession(activeSession.id) }, [activeSession, stopSession])

  const handleContinue = useCallback((session: TimerSession) => {
    createSession(session.projectId, session.name ?? undefined)
  }, [createSession])

  const handleRequestDelete = useCallback((id: string) => setDeletePendingId(id), [])
  const handleCancelDelete = useCallback(() => setDeletePendingId(null), [])
  const handleConfirmDelete = useCallback(async () => {
    if (!deletePendingId) return
    await deleteSession(deletePendingId)
    setDeletePendingId(null)
  }, [deletePendingId, deleteSession])

  const handleProjectRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setProjectRateInput(val)
    const parsed = parseFloat(val)
    if (!isNaN(parsed) && relevantProjectId) {
      setProjectRate(relevantProjectId, parsed)
    }
  }, [relevantProjectId, setProjectRate])

  const handleDefaultRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDefaultRateInput(val)
    const parsed = parseFloat(val)
    if (!isNaN(parsed) && settings) {
      updateSettings(parsed, settings.currency)
    }
  }, [settings, updateSettings])

  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    if (settings) updateSettings(settings.hourlyRate, e.target.value)
  }, [settings, updateSettings])

  const isPaused = activeSession?.status === 'paused'
  const isRunning = activeSession?.status === 'running'

  // The project-rate input's currency prefix is rendered as an absolutely-positioned span
  // inside the input, not a fixed-width character — symbols vary a lot in rendered width
  // (single-character symbols like $/€/£ vs. PKR's multi-character "Rs." prefix, which is
  // roughly 2x as wide at this font size). A single fixed paddingLeft either wastes space
  // for short symbols or lets typed digits butt up against/overlap long ones — PKR is this
  // app's default currency, so that overlap is the out-of-the-box state, not an edge case.
  // Widen the input itself too when the symbol is long, since box-sizing: border-box means
  // extra left padding otherwise eats directly into the usable text-entry width.
  const currencySymbol = getCurrencySymbol(settings?.currency)
  const rateInputPaddingLeft = currencySymbol.length > 1 ? 38 : 24
  const rateInputWidth = currencySymbol.length > 1 ? 104 : 90

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
      {/* Active Timer section */}
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 32, marginBottom: 32, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 24, flexWrap: 'wrap', textAlign: 'left' }}>
          {/* Left column: session name, project, project rate */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', flex: 1, minWidth: 220 }}>
            <input
              type="text"
              placeholder="What are you working on?"
              value={activeSession ? (activeSession.name ?? '') : sessionNameInput}
              onChange={(e) => { setSessionNameInput(e.target.value); if (startError) setStartError('') }}
              disabled={!!activeSession}
              style={{
                minWidth: 240, border: '1px solid var(--timer-input-border)', borderRadius: 8,
                backgroundColor: 'var(--bg-surface)', padding: '8px 12px', fontSize: 14,
                color: 'var(--text-primary)', outline: 'none', opacity: activeSession ? 0.7 : 1,
              }}
            />
            <select
              value={activeSession ? activeSession.projectId : selectedProjectId}
              onChange={(e) => { setSelectedProjectId(e.target.value); if (startError) setStartError('') }}
              disabled={!!activeSession}
              style={{ ...selectStyle, minWidth: 220, opacity: activeSession ? 0.7 : 1 }}
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.name} — ${formatCurrency(settings?.currency, p.hourlyRate ?? settings?.hourlyRate ?? 0)}/hr`}
                </option>
              ))}
            </select>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Project rate</div>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <span
                  style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 13, color: 'var(--text-tertiary)', pointerEvents: 'none',
                  }}
                >
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={projectRateInput}
                  onChange={handleProjectRateChange}
                  disabled={!relevantProjectId}
                  style={{ ...rateInputStyle, width: rateInputWidth, paddingLeft: rateInputPaddingLeft, opacity: relevantProjectId ? 1 : 0.5 }}
                />
              </div>
            </div>
          </div>

          {/* Upper-right column: currency, default rate */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', minWidth: 140 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Currency</div>
              <select value={settings?.currency ?? DEFAULT_CURRENCY} onChange={handleCurrencyChange} style={{ ...selectStyle, padding: '6px 10px', fontSize: 13 }}>
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                  <option key={code} value={code}>{code} ({CURRENCIES[code].prefix.trim()})</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Default rate</div>
              <input
                type="number"
                min={0}
                step="0.01"
                value={defaultRateInput}
                onChange={handleDefaultRateChange}
                style={rateInputStyle}
              />
            </div>
          </div>
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
            <button onClick={handleStart} style={primaryButtonStyle}>
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

        {startError && (
          <p style={{ margin: '16px 0 0', fontSize: 12, color: '#f87171' }}>{startError}</p>
        )}
      </div>

      {/* Stats bar */}
      <StatBar
        cards={[
          {
            label: 'Last 24 hours',
            value: formatHoursMinutes(last24hMs),
            subtitle: lastActivityAt === null ? 'No sessions yet' : `Last worked ${formatRelativeAgo(lastActivityAt)}`,
          },
          { label: 'This week', value: formatHoursMinutes(thisWeekMs) },
          { label: 'Last week', value: formatHoursMinutes(lastWeekMs) },
          { label: 'Since start', value: formatHoursMinutes(sinceStartMs) },
        ]}
      />

      {/* Recent Sessions */}
      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Recent Sessions
        </h3>

        {recentSessions.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
            No sessions in the last 14 days.
          </div>
        ) : (
          recentSessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              project={projectMap.get(session.projectId)}
              segments={segmentsBySessionId[session.id] ?? []}
              onContinue={handleContinue}
              onRename={renameSession}
              onDeleteRequest={handleRequestDelete}
              currency={settings?.currency}
              selectable={false}
            />
          ))
        )}
      </div>

      {deletePendingId && (
        <ConfirmDeleteModal
          title="Delete Session?"
          message="This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  )
}
