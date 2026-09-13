'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { isSameDay, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns'
import { Receipt, Trash2, X } from 'lucide-react'
import { useTimerStore } from '@/lib/store/timerStore'
import { useProjectStore } from '@/lib/store/projectStore'
import { getWeekRange } from '@/lib/timerFormat'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { InvoiceModal } from '@/components/timer/InvoiceModal'
import { SessionRow } from '@/components/timer/SessionRow'
import type { TimerSession } from '@shared/types'

type SessionFilter = 'today' | 'week' | 'month' | 'all'

const FILTERS: { id: SessionFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All' },
]

const badgeStyle: React.CSSProperties = {
  backgroundColor: 'var(--accent-soft)', color: 'var(--accent)',
  fontSize: 12, fontWeight: 600, borderRadius: 999, padding: '2px 9px',
}

const barButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8, border: 'none',
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
  transition: 'opacity 150ms',
}

export function SessionsTab() {
  const {
    sessions, settings, segmentsBySessionId,
    loadSessions, loadSettings, loadSegmentsForSessions,
    createSession, renameSession, deleteSession,
  } = useTimerStore()
  const { projects, loadProjects } = useProjectStore()

  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [showInvoice, setShowInvoice] = useState(false)

  useEffect(() => {
    loadSessions()
    loadSettings()
    loadProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Selection doesn't survive a filter-tab change — a different set of sessions is
  // visible under a different filter, so a stale selection would be confusing.
  useEffect(() => {
    setSelectedIds([])
  }, [sessionFilter])

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  // Flat chronological archive — every session, newest first, no active-first
  // reordering (this isn't a "what's happening now" view like the Timer tab).
  const filteredSortedSessions = useMemo(() => {
    let list = sessions
    if (sessionFilter === 'today') {
      list = list.filter((s) => isSameDay(new Date(s.createdAt), new Date()))
    } else if (sessionFilter !== 'all') {
      const reference = new Date()
      const interval = sessionFilter === 'week' ? getWeekRange(reference) : { start: startOfMonth(reference), end: endOfMonth(reference) }
      list = list.filter((s) => isWithinInterval(new Date(s.createdAt), interval))
    }
    return [...list].sort((a, b) => b.createdAt - a.createdAt)
  }, [sessions, sessionFilter])

  const visibleSessionIdsKey = useMemo(() => filteredSortedSessions.map((s) => s.id).join(','), [filteredSortedSessions])

  useEffect(() => {
    if (visibleSessionIdsKey) loadSegmentsForSessions(visibleSessionIdsKey.split(','))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSessionIdsKey])

  // Only stopped sessions are selectable (SessionRow only renders a checkbox for
  // stopped sessions) — "Select all" must match that, not every visible session.
  const selectableIds = useMemo(
    () => filteredSortedSessions.filter((s) => s.status === 'stopped').map((s) => s.id),
    [filteredSortedSessions]
  )

  const selectedSessions = useMemo(
    () => sessions.filter((s) => selectedIds.includes(s.id)),
    [sessions, selectedIds]
  )

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(selectableIds)
  }, [selectableIds])

  const handleClearSelection = useCallback(() => setSelectedIds([]), [])

  const handleContinue = useCallback((session: TimerSession) => {
    createSession(session.projectId, session.name ?? undefined)
  }, [createSession])

  const handleRequestDelete = useCallback((id: string) => setDeletePendingId(id), [])
  const handleCancelDelete = useCallback(() => setDeletePendingId(null), [])
  const handleConfirmDelete = useCallback(async () => {
    if (!deletePendingId) return
    await deleteSession(deletePendingId)
    setSelectedIds((prev) => prev.filter((x) => x !== deletePendingId))
    setDeletePendingId(null)
  }, [deletePendingId, deleteSession])

  const handleConfirmBulkDelete = useCallback(async () => {
    await Promise.all(selectedIds.map((id) => deleteSession(id)))
    setSelectedIds([])
    setBulkDeleteConfirm(false)
  }, [selectedIds, deleteSession])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setSessionFilter(f.id)}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              backgroundColor: sessionFilter === f.id ? 'var(--accent-soft)' : 'transparent',
              color: sessionFilter === f.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: sessionFilter === f.id ? 600 : 400,
              cursor: 'pointer', transition: 'background-color 150ms, color 150ms',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bulk-action bar */}
      {selectedIds.length > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 20,
            backgroundColor: 'var(--bg-surface-2)', borderRadius: 10,
            padding: '10px 16px', marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Selected</span>
            <span style={badgeStyle}>{selectedIds.length}</span>
          </div>

          <button
            onClick={handleSelectAll}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'none',
              border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Select all</span>
            <span style={badgeStyle}>{selectableIds.length}</span>
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setShowInvoice(true)}
            style={{ ...barButtonStyle, backgroundColor: 'var(--accent)', color: '#ffffff' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <Receipt size={14} /> Generate Invoice {selectedIds.length}
          </button>

          <button
            onClick={() => setBulkDeleteConfirm(true)}
            style={{ ...barButtonStyle, backgroundColor: 'transparent', color: '#f87171', border: '1px solid #f87171' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <Trash2 size={14} /> Delete {selectedIds.length}
          </button>

          <button
            onClick={handleClearSelection}
            aria-label="Clear selection"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              display: 'flex', color: 'var(--text-tertiary)',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Session archive */}
      {filteredSortedSessions.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
          No sessions found.
        </div>
      ) : (
        filteredSortedSessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            project={projectMap.get(session.projectId)}
            segments={segmentsBySessionId[session.id] ?? []}
            onContinue={handleContinue}
            onRename={renameSession}
            onDeleteRequest={handleRequestDelete}
            currency={settings?.currency}
            selectable
            isSelected={selectedIds.includes(session.id)}
            onToggleSelect={handleToggleSelect}
          />
        ))
      )}

      {deletePendingId && (
        <ConfirmDeleteModal
          title="Delete Session?"
          message="This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {bulkDeleteConfirm && (
        <ConfirmDeleteModal
          title={`Delete ${selectedIds.length} session${selectedIds.length === 1 ? '' : 's'}?`}
          message="These sessions and their tracked time will be removed permanently. This cannot be undone."
          onConfirm={handleConfirmBulkDelete}
          onCancel={() => setBulkDeleteConfirm(false)}
        />
      )}

      {showInvoice && (
        <InvoiceModal
          sessions={selectedSessions}
          currency={settings?.currency}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </div>
  )
}
