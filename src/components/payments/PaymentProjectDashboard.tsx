'use client'
import React, { useState, useMemo, useCallback } from 'react'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import type { PaymentProject, PaymentMilestone, PaymentRecord } from '@shared/types'
import { usePaymentStore } from '@/lib/store/paymentStore'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { CURRENCIES, formatCurrency, isCurrencyCode, type CurrencyCode } from '@/lib/currency'

const PRESET_COLORS = [
  '#E879B9', '#A78BFA', '#34D399', '#60A5FA',
  '#FBBF24', '#F87171', '#86EFAC', '#818CF8',
] as const

interface PaymentProjectDashboardProps {
  paymentProject: PaymentProject
  onBack: () => void
}

type PendingDelete = { kind: 'project' | 'milestone' | 'record'; id: string } | null

const smallButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '2px 6px',
  fontSize: 13,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}

const pillButtonStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  border: '1px solid var(--accent)',
  backgroundColor: 'transparent',
  color: 'var(--accent)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 150ms',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 8,
  border: 'none',
  backgroundColor: 'var(--accent)',
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const cancelButtonStyle: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  backgroundColor: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 13,
  cursor: 'pointer',
}

const formInputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
}

const formLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const iconButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  background: 'none',
  border: 'none',
  padding: '4px 8px',
  fontSize: 13,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  borderRadius: 6,
}

export function PaymentProjectDashboard({ paymentProject, onBack }: PaymentProjectDashboardProps) {
  const {
    paymentMilestones, paymentRecords,
    updatePaymentProject, deletePaymentProject,
    createPaymentMilestone, updatePaymentMilestone, deletePaymentMilestone, togglePaymentMilestonePaid,
    createPaymentRecord, deletePaymentRecord,
  } = usePaymentStore()

  const [editingHeader, setEditingHeader] = useState(false)
  const [nameDraft, setNameDraft] = useState(paymentProject.name)
  const [colorDraft, setColorDraft] = useState(paymentProject.color)
  const [totalDraft, setTotalDraft] = useState(String(paymentProject.totalAmount))
  const [developerDraft, setDeveloperDraft] = useState(paymentProject.developer ?? '')
  const [currencyDraft, setCurrencyDraft] = useState<CurrencyCode>(
    isCurrencyCode(paymentProject.currency) ? paymentProject.currency : 'USD'
  )
  const [savingHeader, setSavingHeader] = useState(false)

  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDescription, setMilestoneDescription] = useState('')
  const [milestoneAmount, setMilestoneAmount] = useState('')

  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAmount, setEditAmount] = useState('')

  const [showAddPayment, setShowAddPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)

  const milestones = useMemo(
    () => paymentMilestones.filter((m) => m.paymentProjectId === paymentProject.id),
    [paymentMilestones, paymentProject.id]
  )
  const records = useMemo(
    () => paymentRecords.filter((r) => r.paymentProjectId === paymentProject.id).sort((a, b) => b.paidAt - a.paidAt),
    [paymentRecords, paymentProject.id]
  )

  const paid = useMemo(() => records.reduce((sum, r) => sum + r.amount, 0), [records])
  const remaining = paymentProject.totalAmount - paid
  const milestonesCleared = milestones.filter((m) => m.paid).length

  const handleStartEdit = useCallback(() => {
    setNameDraft(paymentProject.name)
    setColorDraft(paymentProject.color)
    setTotalDraft(String(paymentProject.totalAmount))
    setDeveloperDraft(paymentProject.developer ?? '')
    setCurrencyDraft(isCurrencyCode(paymentProject.currency) ? paymentProject.currency : 'USD')
    setEditingHeader(true)
  }, [paymentProject])

  const handleSaveHeader = useCallback(async () => {
    const trimmedName = nameDraft.trim()
    if (!trimmedName) return
    setSavingHeader(true)
    try {
      const parsedTotal = parseFloat(totalDraft)
      await updatePaymentProject(paymentProject.id, {
        name: trimmedName,
        color: colorDraft,
        totalAmount: isNaN(parsedTotal) ? 0 : parsedTotal,
        developer: developerDraft.trim() || null,
        currency: currencyDraft,
      })
      setEditingHeader(false)
    } finally {
      setSavingHeader(false)
    }
  }, [nameDraft, colorDraft, totalDraft, developerDraft, currencyDraft, updatePaymentProject, paymentProject.id])

  const handleAddMilestone = useCallback(async () => {
    const trimmedTitle = milestoneTitle.trim()
    if (!trimmedTitle) return
    const parsedAmount = parseFloat(milestoneAmount)
    await createPaymentMilestone(paymentProject.id, {
      title: trimmedTitle,
      description: milestoneDescription.trim() || undefined,
      amount: isNaN(parsedAmount) ? 0 : parsedAmount,
    })
    setMilestoneTitle('')
    setMilestoneDescription('')
    setMilestoneAmount('')
    setShowAddMilestone(false)
  }, [milestoneTitle, milestoneDescription, milestoneAmount, createPaymentMilestone, paymentProject.id])

  const startEditMilestone = useCallback((m: PaymentMilestone) => {
    setEditingMilestoneId(m.id)
    setEditTitle(m.title)
    setEditDescription(m.description ?? '')
    setEditAmount(String(m.amount))
  }, [])

  const handleSaveMilestoneEdit = useCallback(async () => {
    if (!editingMilestoneId) return
    const trimmedTitle = editTitle.trim()
    if (!trimmedTitle) return
    const parsedAmount = parseFloat(editAmount)
    await updatePaymentMilestone(editingMilestoneId, {
      title: trimmedTitle,
      description: editDescription.trim() || undefined,
      amount: isNaN(parsedAmount) ? 0 : parsedAmount,
    })
    setEditingMilestoneId(null)
  }, [editingMilestoneId, editTitle, editDescription, editAmount, updatePaymentMilestone])

  const handleAddPayment = useCallback(async () => {
    const parsedAmount = parseFloat(paymentAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    await createPaymentRecord(paymentProject.id, {
      amount: parsedAmount,
      note: paymentNote.trim() || undefined,
    })
    setPaymentAmount('')
    setPaymentNote('')
    setShowAddPayment(false)
  }, [paymentAmount, paymentNote, createPaymentRecord, paymentProject.id])

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    if (pendingDelete.kind === 'project') {
      await deletePaymentProject(pendingDelete.id)
      setPendingDelete(null)
      onBack()
      return
    }
    if (pendingDelete.kind === 'milestone') await deletePaymentMilestone(pendingDelete.id)
    else await deletePaymentRecord(pendingDelete.id)
    setPendingDelete(null)
  }, [pendingDelete, deletePaymentProject, deletePaymentMilestone, deletePaymentRecord, onBack])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '14px 32px 0', flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: '4px 0', marginBottom: 12,
          }}
        >
          <ArrowLeft size={15} /> Back to Projects
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 24px' }}>
        {/* Header card: identity + editable fields + donut */}
        <div style={{
          backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12,
          padding: '20px 24px', marginBottom: 20, display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 320px', minWidth: 280 }}>
            {editingHeader ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={formLabelStyle}>Project Name</label>
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} style={formInputStyle} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={formLabelStyle}>Color</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setColorDraft(color)}
                        style={{
                          width: 24, height: 24, borderRadius: '50%', backgroundColor: color, border: 'none',
                          cursor: 'pointer', padding: 0, outline: colorDraft === color ? '2px solid var(--text-primary)' : 'none', outlineOffset: 2,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={formLabelStyle}>Total Amount</label>
                    <input type="number" min="0" step="0.01" value={totalDraft} onChange={(e) => setTotalDraft(e.target.value)} style={formInputStyle} />
                  </div>
                  <div style={{ flex: '0 0 90px' }}>
                    <label style={formLabelStyle}>Currency</label>
                    <select
                      value={currencyDraft}
                      onChange={(e) => setCurrencyDraft(e.target.value as CurrencyCode)}
                      style={{ ...formInputStyle, cursor: 'pointer' }}
                    >
                      {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={formLabelStyle}>Developer</label>
                    <input value={developerDraft} onChange={(e) => setDeveloperDraft(e.target.value)} style={formInputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditingHeader(false)} style={cancelButtonStyle}>Cancel</button>
                  <button onClick={handleSaveHeader} disabled={savingHeader} style={{ ...primaryButtonStyle, opacity: savingHeader ? 0.7 : 1 }}>
                    {savingHeader ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: paymentProject.color, flexShrink: 0 }} />
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{paymentProject.name}</h2>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    <button onClick={handleStartEdit} style={iconButtonStyle}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      onClick={() => setPendingDelete({ kind: 'project', id: paymentProject.id })}
                      style={{ ...iconButtonStyle, color: '#F87171' }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>

                <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-tertiary)' }}>
                  {paymentProject.developer ? `Dev: ${paymentProject.developer}` : 'No developer assigned'}
                </p>

                <div style={{ display: 'flex', gap: 28 }}>
                  <StatDisplay label="Total" value={paymentProject.totalAmount} currency={paymentProject.currency} />
                  <StatDisplay label="Paid" value={paid} currency={paymentProject.currency} accent />
                  <StatDisplay label="Remaining" value={remaining} currency={paymentProject.currency} />
                  <StatDisplay label="Milestones" value={undefined} currency={paymentProject.currency} display={`${milestonesCleared} / ${milestones.length}`} />
                </div>
              </>
            )}
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <PaymentDonut paid={paid} remaining={Math.max(remaining, 0)} currency={paymentProject.currency} />
          </div>
        </div>

        {/* Milestones + Payments side by side */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 380px', minWidth: 320, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Milestones
              </h3>
              <button onClick={() => setShowAddMilestone((v) => !v)} style={pillButtonStyle}>+ Add Milestone</button>
            </div>

            {showAddMilestone && (
              <div style={{ backgroundColor: 'var(--bg-surface-2)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ marginBottom: 8 }}>
                  <input value={milestoneTitle} onChange={(e) => setMilestoneTitle(e.target.value)} placeholder="Milestone title" style={formInputStyle} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <textarea
                    value={milestoneDescription}
                    onChange={(e) => setMilestoneDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    style={{ ...formInputStyle, resize: 'vertical' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <input type="number" min="0" step="0.01" value={milestoneAmount} onChange={(e) => setMilestoneAmount(e.target.value)} placeholder="Amount" style={formInputStyle} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowAddMilestone(false)} style={cancelButtonStyle}>Cancel</button>
                  <button onClick={handleAddMilestone} style={primaryButtonStyle}>Add</button>
                </div>
              </div>
            )}

            {milestones.length === 0 && !showAddMilestone ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No milestones yet.</p>
            ) : (
              milestones.map((m) =>
                editingMilestoneId === m.id ? (
                  <div key={m.id} style={{ backgroundColor: 'var(--bg-surface-2)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ marginBottom: 8 }}>
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={formInputStyle} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} style={{ ...formInputStyle, resize: 'vertical' }} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <input type="number" min="0" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} style={formInputStyle} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingMilestoneId(null)} style={cancelButtonStyle}>Cancel</button>
                      <button onClick={handleSaveMilestoneEdit} style={primaryButtonStyle}>Save</button>
                    </div>
                  </div>
                ) : (
                  <MilestoneRow
                    key={m.id}
                    milestone={m}
                    currency={paymentProject.currency}
                    onTogglePaid={() => togglePaymentMilestonePaid(m.id)}
                    onEdit={() => startEditMilestone(m)}
                    onDelete={() => setPendingDelete({ kind: 'milestone', id: m.id })}
                  />
                )
              )
            )}
          </div>

          <div style={{ flex: '1 1 320px', minWidth: 280, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Payments
              </h3>
              <button onClick={() => setShowAddPayment((v) => !v)} style={pillButtonStyle}>+ Add Payment</button>
            </div>

            {showAddPayment && (
              <div style={{ backgroundColor: 'var(--bg-surface-2)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ marginBottom: 8 }}>
                  <input type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Amount" style={formInputStyle} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Note (optional)" style={formInputStyle} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowAddPayment(false)} style={cancelButtonStyle}>Cancel</button>
                  <button onClick={handleAddPayment} style={primaryButtonStyle}>Add</button>
                </div>
              </div>
            )}

            {records.length === 0 && !showAddPayment ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No payments recorded yet.</p>
            ) : (
              records.map((r) => {
                const milestone = r.milestoneId ? milestones.find((m) => m.id === r.milestoneId) : undefined
                return (
                  <PaymentRecordRow
                    key={r.id}
                    record={r}
                    currency={paymentProject.currency}
                    milestoneTitle={milestone?.title}
                    onDelete={r.milestoneId ? undefined : () => setPendingDelete({ kind: 'record', id: r.id })}
                  />
                )
              })
            )}
          </div>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDeleteModal
          title={pendingDelete.kind === 'project' ? 'Delete Payment Project?' : pendingDelete.kind === 'milestone' ? 'Delete Milestone?' : 'Delete Payment?'}
          message={
            pendingDelete.kind === 'project'
              ? 'All milestones and payment records for this project will be permanently deleted.'
              : 'This action cannot be undone.'
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

function StatDisplay({ label, value, currency, accent, display }: { label: string; value?: number; currency: string; accent?: boolean; display?: string }) {
  return (
    <div>
      <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>
        {display ?? formatCurrency(currency, value ?? 0)}
      </p>
    </div>
  )
}

function MilestoneRow({
  milestone, currency, onTogglePaid, onEdit, onDelete,
}: {
  milestone: PaymentMilestone
  currency: string
  onTogglePaid: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <button
        onClick={onTogglePaid}
        aria-label={milestone.paid ? 'Mark unpaid' : 'Mark paid'}
        style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
          border: `2px solid ${milestone.paid ? 'var(--accent)' : 'var(--border-strong)'}`,
          backgroundColor: milestone.paid ? 'var(--accent)' : 'transparent',
          cursor: 'pointer', color: '#fff', fontSize: 11, lineHeight: '14px', padding: 0,
        }}
      >
        {milestone.paid ? '✓' : ''}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textDecoration: milestone.paid ? 'line-through' : 'none' }}>
          {milestone.title} &middot; {formatCurrency(currency, milestone.amount)}
        </p>
        {milestone.description && (
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{milestone.description}</p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={onEdit} style={smallButtonStyle}>Edit</button>
        <button onClick={onDelete} style={{ ...smallButtonStyle, color: '#F87171' }}>Delete</button>
      </div>
    </div>
  )
}

function PaymentRecordRow({
  record, currency, milestoneTitle, onDelete,
}: {
  record: PaymentRecord
  currency: string
  milestoneTitle?: string
  onDelete?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>
          {formatCurrency(currency, record.amount)}
          {milestoneTitle ? ` — ${milestoneTitle}` : record.note ? ` — ${record.note}` : ''}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
          {format(new Date(record.paidAt), 'MMM d, yyyy')}
        </p>
      </div>
      {onDelete && (
        <button onClick={onDelete} style={{ ...smallButtonStyle, color: '#F87171' }}>Delete</button>
      )}
    </div>
  )
}

// ─── Donut chart: Paid vs Remaining ──────────────────────────────────────────

function PaymentDonut({ paid, remaining, currency }: { paid: number; remaining: number; currency: string }) {
  const total = paid + remaining
  const size = 132
  const strokeWidth = 16
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const paidPct = total > 0 ? paid / total : 0
  const gap = total > 0 && paid > 0 && remaining > 0 ? 3 : 0

  const paidLength = Math.max(circumference * paidPct - gap, 0)
  const remainingLength = Math.max(circumference * (1 - paidPct) - gap, 0)
  const remainingOffset = -(circumference * paidPct + gap)

  const pct = total > 0 ? Math.round(paidPct * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke="var(--border-subtle)" strokeWidth={strokeWidth}
            />
            {total === 0 ? null : (
              <>
                <circle
                  cx={size / 2} cy={size / 2} r={radius} fill="none"
                  stroke="var(--accent)" strokeWidth={strokeWidth} strokeLinecap="round"
                  strokeDasharray={`${paidLength} ${circumference - paidLength}`}
                />
                <circle
                  cx={size / 2} cy={size / 2} r={radius} fill="none"
                  stroke="var(--text-tertiary)" strokeWidth={strokeWidth} strokeLinecap="round"
                  strokeDasharray={`${remainingLength} ${circumference - remainingLength}`}
                  strokeDashoffset={remainingOffset}
                />
              </>
            )}
          </g>
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{pct}%</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>paid</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        <LegendItem color="var(--accent)" label="Paid" value={paid} currency={currency} />
        <LegendItem color="var(--text-tertiary)" label="Remaining" value={remaining} currency={currency} />
      </div>
    </div>
  )
}

function LegendItem({ color, label, value, currency }: { color: string; label: string; value: number; currency: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        {label} <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(currency, value)}</strong>
      </span>
    </div>
  )
}
