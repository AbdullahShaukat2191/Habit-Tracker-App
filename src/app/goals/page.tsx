'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import type { Goal, Quote } from '@shared/types'
import { useGoalStore } from '@/lib/store/goalStore'
import { listQuotes } from '@/lib/ipc'
import GoalCard from '@/components/goals/GoalCard'
import { GoalModal } from '@/components/goals/GoalModal'
import { GoalCompletedDialog } from '@/components/goals/GoalCompletedDialog'
import { PageQuote } from '@/components/layout/PageQuote'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; goal: Goal }
  | null

export default function GoalsPage() {
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active')
  const [modalState, setModalState] = useState<ModalState>(null)
  const [completedDialogQuote, setCompletedDialogQuote] = useState<Quote | null>(null)
  const [showCompletedDialog, setShowCompletedDialog] = useState(false)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [emptyStateQuote, setEmptyStateQuote] = useState<Quote | null>(null)

  const { goals, loadGoals, createGoal, updateGoal, reorderGoals, completeGoal, uncompleteGoal, deleteGoal } = useGoalStore()

  useEffect(() => {
    loadGoals()
    listQuotes()
      .then((q) => {
        const visible = q.filter((x: Quote) => !x.hidden)
        setQuotes(visible)
        if (visible.length > 0) {
          setEmptyStateQuote(visible[Math.floor(Math.random() * visible.length)])
        }
      })
      .catch(() => {})
  }, [loadGoals])

  useEffect(() => {
    const handleOpenAdd = () => setModalState({ type: 'add' })
    window.addEventListener('open-add-modal', handleOpenAdd)
    return () => window.removeEventListener('open-add-modal', handleOpenAdd)
  }, [])

  const activeGoals = useMemo(
    () => goals.filter((g) => g.completedAt === null && g.archivedAt === null),
    [goals]
  )

  const handleGoalDragEnd = useCallback(
    (activeId: string, overId: string) => {
      const oldIndex = activeGoals.findIndex((g) => g.id === activeId)
      const newIndex = activeGoals.findIndex((g) => g.id === overId)
      if (oldIndex === -1 || newIndex === -1) return
      const newOrder = arrayMove(activeGoals, oldIndex, newIndex)
      reorderGoals(newOrder.map((g) => g.id))
    },
    [activeGoals, reorderGoals]
  )

  const completedGoals = useMemo(
    () =>
      goals
        .filter((g) => g.completedAt !== null && g.archivedAt === null)
        .sort((a, b) => (b.completedAt as number) - (a.completedAt as number)),
    [goals]
  )

  const handleComplete = useCallback(
    async (id: string) => {
      await completeGoal(id)
      const q = quotes.length > 0 ? quotes[Math.floor(Math.random() * quotes.length)] : null
      setCompletedDialogQuote(q)
      setShowCompletedDialog(true)
    },
    [completeGoal, quotes]
  )

  const handleUncomplete = useCallback(
    async (id: string) => {
      await uncompleteGoal(id)
    },
    [uncompleteGoal]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteGoal(id)
    },
    [deleteGoal]
  )

  const handleEdit = useCallback(
    (id: string) => {
      const goal = goals.find(g => g.id === id)
      if (goal) setModalState({ type: 'edit', goal })
    },
    [goals]
  )

  const handleSave = useCallback(
    async (title: string, description: string) => {
      if (modalState?.type === 'add') {
        await createGoal({ title, description: description || undefined })
      } else if (modalState?.type === 'edit') {
        await updateGoal(modalState.goal.id, { title, description: description || undefined })
      }
      setModalState(null)
    },
    [modalState, createGoal, updateGoal]
  )

  const handleModalClose = useCallback(() => setModalState(null), [])
  const handleDialogClose = useCallback(() => setShowCompletedDialog(false), [])

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
      {/* Header */}
      <div
        style={{
          padding: '20px 32px 0',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Long-Term Goals
          </h2>
          <button
            onClick={() => setModalState({ type: 'add' })}
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
            + Add Goal
          </button>
        </div>
        <PageQuote pageId="goals" />

        <div style={{ display: 'flex', gap: 4 }}>
          {(['active', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                backgroundColor: activeTab === tab ? 'var(--bg-surface-2)' : 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab ? 500 : 400,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'background-color 150ms, color 150ms',
              }}
            >
              {tab === 'active' ? 'Active' : 'Completed'}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
        {activeTab === 'active' ? (
          activeGoals.length === 0 ? (
            <EmptyState quote={emptyStateQuote} onAdd={() => setModalState({ type: 'add' })} />
          ) : (
            <SortableGoalList
              goals={activeGoals}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onDragEnd={handleGoalDragEnd}
            />
          )
        ) : (
          completedGoals.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: 200,
                color: 'var(--text-tertiary)',
                fontSize: 14,
              }}
            >
              No completed goals yet. Keep going.
            </div>
          ) : (
            <div>
              {completedGoals.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onComplete={handleComplete}
                  onUncomplete={handleUncomplete}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          )
        )}
      </div>

      <AnimatePresence>
        {modalState && (
          <GoalModal
            key={modalState.type === 'edit' ? modalState.goal.id : 'add'}
            mode={modalState.type}
            goal={modalState.type === 'edit' ? modalState.goal : undefined}
            onSave={handleSave}
            onClose={handleModalClose}
          />
        )}
        {showCompletedDialog && (
          <GoalCompletedDialog
            quote={completedDialogQuote}
            onClose={handleDialogClose}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Sortable Goal components ─────────────────────────────────────────────────

function SortableGoalItem({
  goal,
  onComplete,
  onDelete,
  onEdit,
}: {
  goal: Goal
  onComplete: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onEdit: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: goal.id })

  const dragArrows = (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        alignSelf: 'center', pointerEvents: 'none', flexShrink: 0,
        opacity: hovered && !isDragging ? 0.5 : 0,
        transition: 'opacity 150ms',
      }}
    >
      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1, display: 'block' }}>▲</span>
      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1, display: 'block' }}>▼</span>
    </div>
  )

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
      }}
    >
      <GoalCard
        goal={goal}
        onComplete={onComplete}
        onDelete={onDelete}
        onEdit={onEdit}
        dragIndicator={dragArrows}
      />
    </div>
  )
}

function SortableGoalList({
  goals,
  onComplete,
  onDelete,
  onEdit,
  onDragEnd,
}: {
  goals: Goal[]
  onComplete: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onEdit: (id: string) => void
  onDragEnd: (activeId: string, overId: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const ids = goals.map((g) => g.id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      onDragEnd(String(active.id), String(over.id))
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div>
          {goals.map((g) => (
            <SortableGoalItem
              key={g.id}
              goal={g}
              onComplete={onComplete}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  quote: Quote | null
  onAdd: () => void
}

function EmptyState({ quote, onAdd }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 300,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 16,
          padding: 40,
          textAlign: 'center',
          maxWidth: 480,
          width: '100%',
        }}
      >
        <p
          style={{
            margin: 0,
            marginBottom: quote ? 8 : 32,
            fontSize: 18,
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            fontStyle: quote ? 'italic' : 'normal',
          }}
        >
          {quote ? `"${quote.text}"` : 'What do you want your life to look like?'}
        </p>
        {quote && (
          <p style={{ margin: 0, marginBottom: 32, fontSize: 14, color: 'var(--text-tertiary)' }}>
            — {quote.author}
          </p>
        )}
        <button
          onClick={onAdd}
          style={{
            padding: '8px 20px',
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
          Add your first goal →
        </button>
      </div>
    </div>
  )
}
