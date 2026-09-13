'use client'
import React, { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Pencil, PlusCircle, MinusCircle, Pin } from 'lucide-react'
import { format } from 'date-fns'
import type { Task, Project } from '@shared/types'
import { taskConfetti } from '@/lib/confetti'

interface TaskCardProps {
  task: Task
  project?: Project
  onComplete: (id: string) => void
  onUncomplete?: (id: string) => void
  onDelete: (id: string) => void
  onEdit?: (task: Task) => void
  onToggleOptional?: (id: string) => void
  onTogglePin?: (id: string) => void
  dragIndicator?: React.ReactNode
}

const TaskCard = React.memo(function TaskCard({ task, project, onComplete, onUncomplete, onDelete, onEdit, onToggleOptional, onTogglePin, dragIndicator }: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const wasCompletedOnMount = useRef(task.completedAt !== null)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const isCompleted = task.completedAt !== null
  const isPinned = task.pinnedAt !== null
  const completedToday = isCompleted && format(new Date(task.completedAt as number), 'yyyy-MM-dd') === todayStr
  const canUncomplete = isCompleted && completedToday && !!onUncomplete
  const shouldAnimate = isCompleted && !wasCompletedOnMount.current

  const handleCheckboxClick = useCallback(() => {
    if (!isCompleted) {
      taskConfetti()
      onComplete(task.id)
    } else if (canUncomplete) {
      onUncomplete!(task.id)
    }
  }, [isCompleted, canUncomplete, onComplete, onUncomplete, task.id])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(task.id)
  }, [onDelete, task.id])

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.(task)
  }, [onEdit, task])

  const checkboxCursor = !isCompleted || canUncomplete ? 'pointer' : 'default'

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
        tabIndex={0}
        aria-label={isCompleted ? (canUncomplete ? `Unmark "${task.title}"` : task.title) : `Mark "${task.title}" as complete`}
        onClick={handleCheckboxClick}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && (!isCompleted || canUncomplete)) {
            e.preventDefault()
            handleCheckboxClick()
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
          cursor: checkboxCursor,
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{ color: isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}>
              {task.title}
            </span>
            {isCompleted && (
              <motion.div
                initial={shouldAnimate ? { scaleX: 0 } : { scaleX: 1 }}
                animate={{ scaleX: 1 }}
                transition={shouldAnimate ? { duration: 0.2, ease: 'linear' } : { duration: 0 }}
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

          {project && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: 12,
                backgroundColor: 'var(--bg-surface-2)',
                flexShrink: 0,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: project.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{project.name}</span>
            </div>
          )}
        </div>

        {task.description && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12,
              color: 'var(--text-tertiary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4,
            }}
          >
            {task.description}
          </p>
        )}
      </div>

      {onTogglePin && !isCompleted && (
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(task.id) }}
          title={isPinned ? 'Unpin task' : 'Pin to top'}
          style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer',
            color: isPinned ? 'var(--accent)' : 'var(--text-tertiary)',
            opacity: isHovered || isPinned ? 1 : 0,
            transition: 'opacity 150ms, color 150ms', display: 'flex',
            alignItems: 'center', justifyContent: 'center', borderRadius: 4,
            alignSelf: 'center', flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = isPinned ? 'var(--accent)' : 'var(--text-tertiary)' }}
        >
          <Pin size={14} fill={isPinned ? 'var(--accent)' : 'none'} />
        </button>
      )}

      {onEdit && !isCompleted && (
        <button
          onClick={handleEdit}
          title="Edit task"
          style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer',
            color: 'var(--text-tertiary)', opacity: isHovered ? 1 : 0,
            transition: 'opacity 150ms, color 150ms', display: 'flex',
            alignItems: 'center', justifyContent: 'center', borderRadius: 4,
            alignSelf: 'center', flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          <Pencil size={14} />
        </button>
      )}

      {onToggleOptional && !isCompleted && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleOptional(task.id) }}
          title={task.isOptional ? 'Move back to Today' : 'Move to Optional'}
          style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer',
            color: task.isOptional ? 'var(--accent)' : 'var(--text-tertiary)',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 150ms, color 150ms', display: 'flex',
            alignItems: 'center', justifyContent: 'center', borderRadius: 4,
            alignSelf: 'center', flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = task.isOptional ? 'var(--accent)' : 'var(--text-tertiary)' }}
        >
          {task.isOptional ? <MinusCircle size={14} /> : <PlusCircle size={14} />}
        </button>
      )}

      <button
        onClick={handleDelete}
        title="Delete task"
        style={{
          background: 'none', border: 'none', padding: 4, cursor: 'pointer',
          color: 'var(--text-tertiary)', opacity: isHovered ? 1 : 0,
          transition: 'opacity 150ms, color 150ms', display: 'flex',
          alignItems: 'center', justifyContent: 'center', borderRadius: 4,
          alignSelf: 'center', flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
      >
        <Trash2 size={14} />
      </button>

      {dragIndicator}
    </div>
  )
})

export default TaskCard
