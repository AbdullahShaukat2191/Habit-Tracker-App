# Long-Term Goals Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Long-Term Goals section (GoalCard, GoalModal, GoalCompletedDialog, and GoalsPage) as Phase 3C of the Habit Tracker app.

**Architecture:** Three new component files under `src/components/goals/`, plus a full replacement of `src/app/goals/page.tsx`. GoalCard handles per-card state (expanded, delete confirm), GoalModal handles add/edit with focus trap, GoalCompletedDialog shows the celebration overlay, and GoalsPage orchestrates all state and quotes loading.

**Tech Stack:** React 18, Next.js 14 App Router, TypeScript (strict), framer-motion ^12, lucide-react, Zustand ^5, canvas-confetti (via `@/lib/confetti`)

---

### Task 1: GoalCard component

**Files:**
- Create: `src/components/goals/GoalCard.tsx`

- [ ] **Step 1: Create the GoalCard file with all imports and types**

```tsx
'use client'
import React, { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Goal } from '@shared/types'
import { goalConfetti } from '@/lib/confetti'

interface GoalCardProps {
  goal: Goal
  onComplete: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onEdit: (goal: Goal) => void
}
```

- [ ] **Step 2: Implement the full GoalCard component body**

```tsx
const GoalCard = React.memo(function GoalCard({
  goal,
  onComplete,
  onDelete,
  onEdit,
}: GoalCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const wasCompletedOnMount = useRef(goal.completedAt !== null)

  const isCompleted = goal.completedAt !== null
  const shouldAnimate = isCompleted && !wasCompletedOnMount.current

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isCompleted) return
      goalConfetti()
      onComplete(goal.id)
    },
    [isCompleted, onComplete, goal.id]
  )

  const handleCardClick = useCallback(() => {
    if (showDeleteConfirm) return
    setIsExpanded((v) => !v)
  }, [showDeleteConfirm])

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsExpanded(false)
      onEdit(goal)
    },
    [onEdit, goal]
  )

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }, [])

  const handleDeleteConfirm = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      setDeleting(true)
      try {
        await onDelete(goal.id)
      } finally {
        setDeleting(false)
      }
    },
    [onDelete, goal.id]
  )

  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(false)
  }, [])

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${isHovered ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 10,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        cursor: 'pointer',
        transition: 'border-color 150ms',
      }}
    >
      {/* Checkbox */}
      <div
        role="checkbox"
        aria-checked={isCompleted}
        tabIndex={isCompleted ? -1 : 0}
        aria-label={`Mark "${goal.title}" as complete`}
        onClick={handleCheckboxClick}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !isCompleted) {
            e.preventDefault()
            goalConfetti()
            onComplete(goal.id)
          }
        }}
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: isCompleted ? 'none' : '1px solid var(--border-strong)',
          backgroundColor: isCompleted ? 'var(--accent-pink)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: isCompleted ? 'default' : 'pointer',
          transition: 'background-color 150ms, border-color 150ms',
          marginTop: 1,
        }}
      >
        {isCompleted && (
          <span style={{ color: '#ffffff', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
            ✓
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title with optional strikethrough */}
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <span
            style={{
              color: isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)',
              fontSize: 15,
              fontWeight: 500,
              display: 'block',
            }}
          >
            {goal.title}
          </span>
          {isCompleted && (
            <motion.div
              initial={shouldAnimate ? { scaleX: 0 } : { scaleX: 1 }}
              animate={{ scaleX: 1 }}
              transition={shouldAnimate ? { duration: 0.4, ease: 'linear' } : { duration: 0 }}
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: 1.5,
                backgroundColor: 'var(--text-secondary)',
                transformOrigin: 'left center',
                transform: 'translateY(-50%)',
              }}
            />
          )}
        </div>

        {/* Description */}
        {goal.description && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 13,
              color: 'var(--text-tertiary)',
              lineHeight: 1.5,
            }}
          >
            {goal.description}
          </p>
        )}

        {/* Expanded: edit/delete actions */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ marginTop: 10 }}>
                <AnimatePresence mode="wait">
                  {showDeleteConfirm ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Delete goal?
                      </span>
                      <button
                        onClick={handleCancelDelete}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 6,
                          padding: '3px 10px',
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'border-color 150ms',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-strong)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteConfirm}
                        disabled={deleting}
                        style={{
                          background: '#ef4444',
                          border: 'none',
                          borderRadius: 6,
                          padding: '3px 10px',
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#ffffff',
                          cursor: deleting ? 'not-allowed' : 'pointer',
                          opacity: deleting ? 0.7 : 1,
                          transition: 'opacity 150ms',
                        }}
                      >
                        {deleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="actions"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      style={{ display: 'flex', gap: 8 }}
                    >
                      <button
                        aria-label={`Edit "${goal.title}"`}
                        onClick={handleEdit}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px 6px',
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'color 150ms',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--text-primary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-secondary)'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        aria-label={`Delete "${goal.title}"`}
                        onClick={handleDeleteClick}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px 6px',
                          fontSize: 13,
                          color: '#F87171',
                          cursor: 'pointer',
                          transition: 'color 150ms',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ef4444'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#F87171'
                        }}
                      >
                        Delete
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
})

export default GoalCard
```

---

### Task 2: GoalModal component

**Files:**
- Create: `src/components/goals/GoalModal.tsx`

- [ ] **Step 1: Create GoalModal with focus trap (same pattern as ProjectModal)**

```tsx
'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Goal } from '@shared/types'

interface GoalModalProps {
  mode: 'add' | 'edit'
  goal?: Goal
  onSave: (title: string, description: string) => Promise<void>
  onClose: () => void
}

export function GoalModal({ mode, goal, onSave, onClose }: GoalModalProps) {
  const [title, setTitle] = useState(mode === 'edit' && goal ? goal.title : '')
  const [description, setDescription] = useState(
    mode === 'edit' && goal && goal.description ? goal.description : ''
  )
  const [titleError, setTitleError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const titleInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Auto-focus title input
  useEffect(() => {
    const id = setTimeout(() => titleInputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [])

  // Focus trap + Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      if (!modalRef.current) return
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const elements = Array.from(focusable)
      if (elements.length === 0) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSave = useCallback(async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError('Goal title is required')
      titleInputRef.current?.focus()
      return
    }
    setTitleError('')
    setSaving(true)
    setSaveError('')
    try {
      await onSave(trimmed, description.trim())
      onClose()
    } catch {
      setSaveError('Failed to save goal. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [title, description, onSave, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
      }}
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-modal-title"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 12,
          border: '1px solid var(--border-subtle)',
          padding: 28,
          width: 480,
          maxWidth: '90vw',
          boxSizing: 'border-box',
        }}
      >
        <h2
          id="goal-modal-title"
          style={{
            margin: 0,
            marginBottom: 20,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {mode === 'add' ? 'Add Goal' : 'Edit Goal'}
        </h2>

        {/* Title field */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="goal-title-input"
            style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Goal Title
          </label>
          <input
            id="goal-title-input"
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (titleError) setTitleError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
            }}
            placeholder="e.g. Finish my Computer Science degree"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: 'var(--bg-input)',
              border: `1px solid ${titleError ? '#f87171' : 'var(--border-subtle)'}`,
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 14,
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 150ms',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => {
              if (!titleError) e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
            onBlur={(e) => {
              if (!titleError) e.currentTarget.style.borderColor = 'var(--border-subtle)'
            }}
          />
          {titleError && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>{titleError}</p>
          )}
        </div>

        {/* Description field */}
        <div style={{ marginBottom: 24 }}>
          <label
            htmlFor="goal-description-input"
            style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Description / Vision{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              (optional)
            </span>
          </label>
          <textarea
            id="goal-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does achieving this goal mean to you?"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 14,
              color: 'var(--text-primary)',
              outline: 'none',
              resize: 'vertical',
              transition: 'border-color 150ms',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)'
            }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 150ms, color 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: 'var(--accent-pink)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'opacity 150ms',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {saveError && (
          <p style={{ color: '#F87171', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
            {saveError}
          </p>
        )}
      </motion.div>
    </div>
  )
}
```

---

### Task 3: GoalCompletedDialog component

**Files:**
- Create: `src/components/goals/GoalCompletedDialog.tsx`

- [ ] **Step 1: Create GoalCompletedDialog**

Note: goalConfetti is NOT called here — it was already called by GoalCard on checkbox click.

```tsx
'use client'
import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Quote } from '@shared/types'

interface GoalCompletedDialogProps {
  quote: Quote | null
  onClose: () => void
}

export function GoalCompletedDialog({ quote, onClose }: GoalCompletedDialogProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)',
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-done-title"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          padding: 48,
          maxWidth: 540,
          width: '90vw',
          textAlign: 'center',
          boxSizing: 'border-box',
          cursor: 'default',
        }}
      >
        <h1
          id="goal-done-title"
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          A life goal complete.
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: 16,
            color: 'var(--text-tertiary)',
          }}
        >
          This is who you&apos;re becoming.
        </p>

        {quote && (
          <div style={{ marginTop: 36 }}>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                fontStyle: 'italic',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              &ldquo;{quote.text}&rdquo;
            </p>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 13,
                color: 'var(--text-tertiary)',
              }}
            >
              &mdash; {quote.author}
            </p>
          </div>
        )}

        <p
          style={{
            margin: '32px 0 0',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            opacity: 0.6,
          }}
        >
          Click anywhere to close
        </p>
      </motion.div>
    </div>
  )
}
```

---

### Task 4: GoalsPage (full replacement of src/app/goals/page.tsx)

**Files:**
- Modify: `src/app/goals/page.tsx`

- [ ] **Step 1: Write the full GoalsPage**

```tsx
'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Goal, Quote } from '@shared/types'
import { useGoalStore } from '@/lib/store/goalStore'
import { listQuotes } from '@/lib/ipc'
import GoalCard from '@/components/goals/GoalCard'
import { GoalModal } from '@/components/goals/GoalModal'
import { GoalCompletedDialog } from '@/components/goals/GoalCompletedDialog'

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; goal: Goal }
  | null

export default function GoalsPage() {
  const [modalState, setModalState] = useState<ModalState>(null)
  const [completedDialogQuote, setCompletedDialogQuote] = useState<Quote | null>(null)
  const [showCompletedDialog, setShowCompletedDialog] = useState(false)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [emptyStateQuote, setEmptyStateQuote] = useState<Quote | null>(null)

  const { goals, loadGoals, createGoal, updateGoal, completeGoal, deleteGoal } = useGoalStore()

  useEffect(() => {
    loadGoals()
    listQuotes()
      .then((q) => {
        const visible = q.filter((x) => !x.hidden)
        setQuotes(visible)
        if (visible.length > 0) {
          setEmptyStateQuote(visible[Math.floor(Math.random() * visible.length)])
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter out archived goals
  const visibleGoals = useMemo(
    () => goals.filter((g) => g.archivedAt === null),
    [goals]
  )

  // Sort: incomplete first (createdAt asc), then completed (completedAt asc)
  const sortedGoals = useMemo(() => {
    return [...visibleGoals].sort((a, b) => {
      const aComplete = a.completedAt !== null
      const bComplete = b.completedAt !== null
      if (aComplete === bComplete) {
        if (!aComplete) return a.createdAt - b.createdAt
        return (a.completedAt as number) - (b.completedAt as number)
      }
      return aComplete ? 1 : -1
    })
  }, [visibleGoals])

  const handleComplete = useCallback(
    async (id: string) => {
      await completeGoal(id)
      const q = quotes.length > 0 ? quotes[Math.floor(Math.random() * quotes.length)] : null
      setCompletedDialogQuote(q)
      setShowCompletedDialog(true)
    },
    [completeGoal, quotes]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteGoal(id)
    },
    [deleteGoal]
  )

  const handleEdit = useCallback((goal: Goal) => {
    setModalState({ type: 'edit', goal })
  }, [])

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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 32px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
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
            border: '1px solid var(--accent-pink)',
            backgroundColor: 'transparent',
            color: 'var(--accent-pink)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-pink-soft)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          + Add Goal
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 32px',
        }}
      >
        {sortedGoals.length === 0 ? (
          <EmptyState quote={emptyStateQuote} onAdd={() => setModalState({ type: 'add' })} />
        ) : (
          sortedGoals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modalState && (
          <GoalModal
            key={modalState.type === 'edit' ? modalState.goal.id : 'add'}
            mode={modalState.type}
            goal={modalState.type === 'edit' ? modalState.goal : undefined}
            onSave={handleSave}
            onClose={() => setModalState(null)}
          />
        )}
        {showCompletedDialog && (
          <GoalCompletedDialog
            quote={completedDialogQuote}
            onClose={() => setShowCompletedDialog(false)}
          />
        )}
      </AnimatePresence>
    </div>
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
          <p
            style={{
              margin: 0,
              marginBottom: 32,
              fontSize: 14,
              color: 'var(--text-tertiary)',
            }}
          >
            — {quote.author}
          </p>
        )}
        <button
          onClick={onAdd}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: '1px solid var(--accent-pink)',
            backgroundColor: 'transparent',
            color: 'var(--accent-pink)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-pink-soft)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          Add your first goal →
        </button>
      </div>
    </div>
  )
}
```

---

### Task 5: TypeScript check

**Files:** (no changes)

- [ ] **Step 1: Run TypeScript compiler check**

Run: `npx tsc --noEmit`
Expected: zero errors output

- [ ] **Step 2: Run tests**

Run: `npm test -- --passWithNoTests`
Expected: 14/14 tests pass (existing tests only; no new tests added since these are pure UI components)
