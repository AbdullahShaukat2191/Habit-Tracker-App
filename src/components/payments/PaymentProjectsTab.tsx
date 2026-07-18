'use client'
import React, { useState, useMemo, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { PaymentProject, CreatePaymentProjectInput } from '@shared/types'
import { usePaymentStore } from '@/lib/store/paymentStore'
import { useProjectStore } from '@/lib/store/projectStore'
import PaymentProjectCard from './PaymentProjectCard'
import { AddPaymentProjectModal } from './AddPaymentProjectModal'
import { PaymentProjectDashboard } from './PaymentProjectDashboard'

export default function PaymentProjectsTab() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)

  const { paymentProjects, paymentMilestones, paymentRecords, createPaymentProject, importPaymentProjects } = usePaymentStore()
  const { projects } = useProjectStore()

  const statsByProject = useMemo(() => {
    const map = new Map<string, { paid: number; milestonesTotal: number; milestonesCleared: number }>()
    for (const pp of paymentProjects) map.set(pp.id, { paid: 0, milestonesTotal: 0, milestonesCleared: 0 })
    for (const m of paymentMilestones) {
      const entry = map.get(m.paymentProjectId)
      if (!entry) continue
      entry.milestonesTotal++
      if (m.paid) entry.milestonesCleared++
    }
    for (const r of paymentRecords) {
      const entry = map.get(r.paymentProjectId)
      if (entry) entry.paid += r.amount
    }
    return map
  }, [paymentProjects, paymentMilestones, paymentRecords])

  const importedSourceIds = useMemo(
    () => new Set(paymentProjects.map((p) => p.sourceProjectId).filter((id): id is string => id !== null)),
    [paymentProjects]
  )
  const importableProjects = useMemo(
    () => projects.filter((p) => !importedSourceIds.has(p.id)),
    [projects, importedSourceIds]
  )

  const handleCreate = useCallback(async (input: CreatePaymentProjectInput) => {
    await createPaymentProject(input)
  }, [createPaymentProject])

  const handleImport = useCallback(async (projectIds: string[]) => {
    await importPaymentProjects(projectIds)
  }, [importPaymentProjects])

  const openProject = paymentProjects.find((p) => p.id === openProjectId) ?? null

  if (openProject) {
    return <PaymentProjectDashboard paymentProject={openProject} onBack={() => setOpenProjectId(null)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '16px 32px 0', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '7px 16px', borderRadius: 8, border: '1px solid var(--accent)',
            backgroundColor: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', transition: 'background-color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          + Add Project
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
        {paymentProjects.length === 0 ? (
          <EmptyState onAdd={() => setShowAddModal(true)} />
        ) : (
          <div>
            {paymentProjects.map((pp: PaymentProject) => (
              <PaymentProjectCard
                key={pp.id}
                paymentProject={pp}
                paid={statsByProject.get(pp.id)?.paid ?? 0}
                milestonesTotal={statsByProject.get(pp.id)?.milestonesTotal ?? 0}
                milestonesCleared={statsByProject.get(pp.id)?.milestonesCleared ?? 0}
                onClick={() => setOpenProjectId(pp.id)}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <AddPaymentProjectModal
            importableProjects={importableProjects}
            onCreate={handleCreate}
            onImport={handleImport}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', minHeight: 300, gap: 12, color: 'var(--text-tertiary)', fontSize: 14,
      }}
    >
      <span>No payment projects yet.</span>
      <button
        onClick={onAdd}
        style={{
          padding: '7px 16px', borderRadius: 8, border: '1px solid var(--accent)',
          backgroundColor: 'transparent', color: 'var(--accent)', fontSize: 14, fontWeight: 500,
          cursor: 'pointer', transition: 'background-color 150ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        + Add Project
      </button>
    </div>
  )
}
