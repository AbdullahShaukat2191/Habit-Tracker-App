'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Trash2, Pencil } from 'lucide-react'
import type { Goal } from '@shared/types'
import { goalConfetti } from '@/lib/confetti'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

interface GoalCardProps {
  goal: Goal
  onComplete: (id: string) => Promise<void>
  onUncomplete?: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onEdit: (id: string) => void
  dragIndicator?: React.ReactNode
}

const GoalCard = React.memo(function GoalCard({
  goal,
  onComplete,
  onUncomplete,
  onDelete,
  onEdit,
  dragIndicator,
}: GoalCardProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const wasCompletedOnMount = useRef(goal.completedAt !== null)
  const justCompletedRef = useRef(false)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const isCompleted = goal.completedAt !== null
  const completedToday = isCompleted && format(new Date(goal.completedAt as number), 'yyyy-MM-dd') === todayStr
  const canUncomplete = isCompleted && completedToday && !!onUncomplete
  const shouldAnimate = isCompleted && !wasCompletedOnMount.current

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!isCompleted) {
        justCompletedRef.current = true
        onComplete(goal.id)
      } else if (canUncomplete) {
        onUncomplete!(goal.id)
      }
    },
    [isCompleted, canUncomplete, onComplete, onUncomplete, goal.id]
  )

  useEffect(() => {
    if (isCompleted && justCompletedRef.current) {
      justCompletedRef.current = false
      const timer = setTimeout(() => goalConfetti(), 400)
      return () => clearTimeout(timer)
    }
  }, [isCompleted])

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onEdit(goal.id)
    },
    [onEdit, goal.id]
  )

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowConfirmModal(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    setShowConfirmModal(false)
    await onDelete(goal.id)
  }, [onDelete, goal.id])

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${isHovered ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 8,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        transition: 'border-color 150ms',
      }}
    >
      {/* Checkbox */}
      <div
        role="checkbox"
        aria-checked={isCompleted}
        tabIndex={!isCompleted || canUncomplete ? 0 : -1}
        aria-label={isCompleted ? (canUncomplete ? `Unmark "${goal.title}"` : goal.title) : `Mark "${goal.title}" as complete`}
        onClick={handleCheckboxClick}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && (!isCompleted || canUncomplete)) {
            e.preventDefault()
            if (!isCompleted) {
              justCompletedRef.current = true
              onComplete(goal.id)
            } else {
              onUncomplete!(goal.id)
            }
          }
        }}
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: isCompleted ? 'none' : '1px solid var(--border-strong)',
          backgroundColor: isCompleted ? 'var(--accent)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: !isCompleted || canUncomplete ? 'pointer' : 'default',
          transition: 'background-color 150ms, border-color 150ms, opacity 150ms',
          marginTop: 1,
          opacity: isCompleted && !canUncomplete ? 0.6 : 1,
        }}
        title={canUncomplete ? 'Click to undo (completed today)' : undefined}
      >
        {isCompleted && (
          <span style={{ color: '#ffffff', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>✓</span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
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

        {goal.description && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            {goal.description}
          </p>
        )}
      </div>

      {/* Action buttons — always rendered to prevent layout shift; opacity-controlled */}
      {!isCompleted && (
        <button
          onClick={handleEdit}
          title="Edit goal"
          style={{
            background: 'none',
            border: 'none',
            padding: 4,
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 150ms, color 150ms',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            alignSelf: 'center',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          <Pencil size={14} />
        </button>
      )}

      <button
        onClick={handleDeleteClick}
        title="Delete goal"
        style={{
          background: 'none',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          color: 'var(--text-tertiary)',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 150ms, color 150ms',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          alignSelf: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
      >
        <Trash2 size={14} />
      </button>

      {dragIndicator}

      {showConfirmModal && (
        <ConfirmDeleteModal
          title="Delete Goal?"
          message="This action cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  )
})

export default GoalCard
