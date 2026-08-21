'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import type { Project } from '@shared/types'
import { useProjectStore } from '@/lib/store/projectStore'
import { useTaskStore } from '@/lib/store/taskStore'
import ProjectCard from '@/components/projects/ProjectCard'
import { ProjectModal } from '@/components/projects/ProjectModal'
import PaymentsView from '@/components/payments/PaymentsView'
import { PageQuote } from '@/components/layout/PageQuote'

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; project: Project }
  | null

const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 5 } }

export default function ProjectsPage() {
  const [outerTab, setOuterTab] = useState<'projects' | 'payments'>('projects')
  const [modalState, setModalState] = useState<ModalState>(null)

  const { projects, loadProjects, createProject, updateProject, reorderProjects, deleteProject } =
    useProjectStore()
  const { tasks, loadTasks } = useTaskStore()

  const sensors = useSensors(useSensor(PointerSensor, POINTER_SENSOR_OPTIONS))

  const taskCountsMap = useMemo(() => {
    const map = new Map<string, { active: number; completed: number }>()
    for (const task of tasks) {
      if (!task.projectId || task.archivedAt !== null) continue
      const entry = map.get(task.projectId) ?? { active: 0, completed: 0 }
      if (task.completedAt === null) entry.active++
      else entry.completed++
      map.set(task.projectId, entry)
    }
    return map
  }, [tasks])

  useEffect(() => {
    loadProjects()
    loadTasks()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleOpenAddEvent = () => setModalState({ type: 'add' })
    window.addEventListener('open-add-modal', handleOpenAddEvent)
    return () => window.removeEventListener('open-add-modal', handleOpenAddEvent)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = projects.findIndex((p) => p.id === active.id)
      const newIndex = projects.findIndex((p) => p.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const newOrder = arrayMove(projects, oldIndex, newIndex)
      reorderProjects(newOrder.map((p) => p.id))
    },
    [projects, reorderProjects]
  )

  const handleOpenAdd = useCallback(() => setModalState({ type: 'add' }), [])
  const handleOpenEdit = useCallback((project: Project) => setModalState({ type: 'edit', project }), [])
  const handleCloseModal = useCallback(() => setModalState(null), [])

  const handleSave = useCallback(
    async (name: string, color: string) => {
      if (modalState?.type === 'add') {
        await createProject({ name, color })
      } else if (modalState?.type === 'edit') {
        await updateProject(modalState.project.id, { name, color })
      }
    },
    [modalState, createProject, updateProject]
  )

  const handleDelete = useCallback(
    async (id: string) => { await deleteProject(id) },
    [deleteProject]
  )

  const projectIds = projects.map((p) => p.id)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
        maxWidth: 1100,
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Header — title changes with the active section, tabs live beneath it */}
      <div
        style={{
          padding: '20px 32px 0',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {outerTab === 'projects' ? 'Projects' : 'Payments'}
          </h2>
          {outerTab === 'projects' && (
            <button
              onClick={handleOpenAdd}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                border: '1px solid var(--accent)',
                backgroundColor: 'transparent',
                color: 'var(--accent)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              + Add Project
            </button>
          )}
        </div>

        {outerTab === 'projects' ? (
          <PageQuote pageId="projects" />
        ) : (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Track what’s been paid, what’s owed, and what’s next.
          </p>
        )}

        <div style={{ display: 'flex', gap: 4 }}>
          {(['projects', 'payments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setOuterTab(tab)}
              style={{
                padding: '6px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                backgroundColor: outerTab === tab ? 'var(--bg-surface-2)' : 'transparent',
                color: outerTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: outerTab === tab ? 500 : 400,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'background-color 150ms, color 150ms',
              }}
            >
              {tab === 'projects' ? 'Projects' : 'Payments'}
            </button>
          ))}
        </div>
      </div>

      {outerTab === 'projects' ? (
        <>
          {/* Card list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
            {projects.length === 0 ? (
              <EmptyState onAdd={handleOpenAdd} />
            ) : (
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext items={projectIds} strategy={rectSortingStrategy}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16 }}>
                    {projects.map((p) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        activeTasks={taskCountsMap.get(p.id)?.active ?? 0}
                        completedTasks={taskCountsMap.get(p.id)?.completed ?? 0}
                        onEdit={handleOpenEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <AnimatePresence>
            {modalState && (
              <ProjectModal
                key={modalState.type === 'edit' ? modalState.project.id : 'add'}
                mode={modalState.type}
                project={modalState.type === 'edit' ? modalState.project : undefined}
                onSave={handleSave}
                onClose={handleCloseModal}
              />
            )}
          </AnimatePresence>
        </>
      ) : (
        <PaymentsView />
      )}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 300,
        gap: 12,
        color: 'var(--text-tertiary)',
        fontSize: 14,
      }}
    >
      <span>No projects yet.</span>
      <button
        onClick={onAdd}
        style={{
          padding: '7px 16px',
          borderRadius: 8,
          border: '1px solid var(--accent)',
          backgroundColor: 'transparent',
          color: 'var(--accent)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background-color 150ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-soft)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        + Add Project
      </button>
    </div>
  )
}
