'use client'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { format, isYesterday } from 'date-fns'
import type { PaymentRecord } from '@shared/types'
import { usePaymentStore } from '@/lib/store/paymentStore'

function buildGroupLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  if (isYesterday(date)) return 'Yesterday — ' + format(date, 'EEE MMM d')
  return format(date, 'EEE MMM d')
}

type SortOrder = 'asc' | 'desc' | 'projects'

export default function PaymentHistoryTab() {
  const { paymentProjects, paymentMilestones, paymentRecords } = usePaymentStore()

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    try {
      const v = localStorage.getItem('paymentHistory:sortOrder')
      return (v === 'asc' || v === 'desc' || v === 'projects') ? v : 'desc'
    } catch { return 'desc' }
  })
  const [groupByDate, setGroupByDate] = useState(() => {
    try { return localStorage.getItem('paymentHistory:groupByDate') === '1' } catch { return false }
  })
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const sortDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { localStorage.setItem('paymentHistory:groupByDate', groupByDate ? '1' : '0') } catch {}
  }, [groupByDate])
  useEffect(() => {
    try { localStorage.setItem('paymentHistory:sortOrder', sortOrder) } catch {}
  }, [sortOrder])

  useEffect(() => {
    if (!sortDropdownOpen) return
    const handle = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setSortDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [sortDropdownOpen])

  const projectMap = useMemo(() => new Map(paymentProjects.map((p) => [p.id, p])), [paymentProjects])
  const milestoneMap = useMemo(() => new Map(paymentMilestones.map((m) => [m.id, m])), [paymentMilestones])

  const recordCountByProject = useMemo(() => {
    const count = new Map<string, number>()
    paymentRecords.forEach((r) => count.set(r.paymentProjectId, (count.get(r.paymentProjectId) ?? 0) + 1))
    return count
  }, [paymentRecords])

  const sortedRecords = useMemo(() => {
    if (sortOrder === 'projects') {
      return [...paymentRecords].sort((a, b) => {
        const nameA = projectMap.get(a.paymentProjectId)?.name ?? ''
        const nameB = projectMap.get(b.paymentProjectId)?.name ?? ''
        if (nameA !== nameB) return nameA.localeCompare(nameB)
        return b.paidAt - a.paidAt
      })
    }
    return [...paymentRecords].sort((a, b) => sortOrder === 'asc' ? a.paidAt - b.paidAt : b.paidAt - a.paidAt)
  }, [paymentRecords, sortOrder, projectMap])

  const rowLabel = (r: PaymentRecord) => {
    const milestone = r.milestoneId ? milestoneMap.get(r.milestoneId) : undefined
    if (milestone) return milestone.title
    return r.note ?? 'Manual payment'
  }

  if (paymentRecords.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, color: 'var(--text-tertiary)', fontSize: 14, padding: '0 32px' }}>
        No payments recorded yet. Payments appear here automatically as you clear milestones or add payments from a project.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '16px 32px 0', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div ref={sortDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setSortDropdownOpen((o) => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)',
                backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                transition: 'border-color 150ms, color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              {sortOrder === 'asc' ? '↑ Oldest' : sortOrder === 'desc' ? '↓ Newest' : '◈ Projects'}
              {sortDropdownOpen ? <ChevronUp size={11} strokeWidth={2} /> : <ChevronDown size={11} strokeWidth={2} />}
            </button>
            {sortDropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
                backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                minWidth: 120, overflow: 'hidden',
              }}>
                {(['desc', 'asc', 'projects'] as SortOrder[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setSortOrder(opt); setSortDropdownOpen(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '7px 12px', border: 'none', cursor: 'pointer',
                      fontSize: 12, backgroundColor: sortOrder === opt ? 'var(--bg-surface-2)' : 'transparent',
                      color: sortOrder === opt ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: sortOrder === opt ? 500 : 400,
                    }}
                    onMouseEnter={(e) => { if (sortOrder !== opt) e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)' }}
                    onMouseLeave={(e) => { if (sortOrder !== opt) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    {opt === 'asc' ? '↑ Oldest' : opt === 'desc' ? '↓ Newest' : '◈ Projects'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setGroupByDate((g) => !g)}
            title={groupByDate ? 'Ungroup' : 'Group'}
            style={{
              padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${groupByDate ? 'var(--accent)' : 'var(--border-subtle)'}`,
              backgroundColor: groupByDate ? 'var(--accent-soft)' : 'transparent',
              color: groupByDate ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, cursor: 'pointer', transition: 'all 150ms',
            }}
          >
            Group
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
        {!groupByDate ? (
          <div>
            {sortedRecords.map((r) => (
              <RecordRow key={r.id} record={r} label={rowLabel(r)} projectName={projectMap.get(r.paymentProjectId)?.name} projectColor={projectMap.get(r.paymentProjectId)?.color} />
            ))}
          </div>
        ) : sortOrder === 'projects' ? (
          <GroupedByProject
            records={sortedRecords}
            projectMap={projectMap}
            recordCountByProject={recordCountByProject}
            rowLabel={rowLabel}
          />
        ) : (
          <GroupedByDate records={sortedRecords} sortOrder={sortOrder} projectMap={projectMap} rowLabel={rowLabel} />
        )}
      </div>
    </div>
  )
}

function RecordRow({
  record, label, projectName, projectColor,
}: {
  record: PaymentRecord
  label: string
  projectName?: string
  projectColor?: string
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 10, padding: '12px 16px', marginBottom: 8,
      }}
    >
      {projectColor && (
        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: projectColor, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>
          {projectName ?? 'Unknown project'} — {label}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
          {format(new Date(record.paidAt), 'MMM d, yyyy')}
        </p>
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
        ${record.amount.toLocaleString()}
      </span>
    </div>
  )
}

function GroupedByDate({
  records, sortOrder, projectMap, rowLabel,
}: {
  records: PaymentRecord[]
  sortOrder: SortOrder
  projectMap: Map<string, import('@shared/types').PaymentProject>
  rowLabel: (r: PaymentRecord) => string
}) {
  const groups = new Map<string, PaymentRecord[]>()
  for (const r of records) {
    const key = format(new Date(r.paidAt), 'yyyy-MM-dd')
    const existing = groups.get(key)
    if (existing) existing.push(r)
    else groups.set(key, [r])
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) =>
    sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  )

  return (
    <div>
      {sortedKeys.map((key) => {
        const groupRecords = (groups.get(key) as PaymentRecord[]).slice().sort((a, b) =>
          sortOrder === 'asc' ? a.paidAt - b.paidAt : b.paidAt - a.paidAt
        )
        return (
          <div key={key} style={{ marginBottom: 20 }}>
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {buildGroupLabel(key)}
            </h3>
            {groupRecords.map((r) => {
              const project = projectMap.get(r.paymentProjectId)
              return <RecordRow key={r.id} record={r} label={rowLabel(r)} projectName={project?.name} projectColor={project?.color} />
            })}
          </div>
        )
      })}
    </div>
  )
}

function GroupedByProject({
  records, projectMap, recordCountByProject, rowLabel,
}: {
  records: PaymentRecord[]
  projectMap: Map<string, import('@shared/types').PaymentProject>
  recordCountByProject: Map<string, number>
  rowLabel: (r: PaymentRecord) => string
}) {
  const projectGroups = new Map<string, PaymentRecord[]>()
  for (const r of records) {
    const key = r.paymentProjectId
    if (!projectGroups.has(key)) projectGroups.set(key, [])
    projectGroups.get(key)!.push(r)
  }
  return (
    <div>
      {Array.from(projectGroups.entries()).map(([projectId, groupRecords]) => {
        const project = projectMap.get(projectId)
        const label = project ? project.name : 'Unknown project'
        const count = recordCountByProject.get(projectId) ?? groupRecords.length
        return (
          <div key={projectId} style={{ marginBottom: 20 }}>
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {label} &middot; {count}
            </h3>
            {groupRecords.map((r) => (
              <RecordRow key={r.id} record={r} label={rowLabel(r)} projectName={project?.name} projectColor={project?.color} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
