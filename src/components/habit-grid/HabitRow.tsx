'use client'
import React, { useCallback, useMemo, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import type { Habit, HabitCompletion } from '@shared/types'
import {
  isApplicableDay,
  computeScore,
  computeStreak,
  buildCompletionSet,
  getApplicableDays,
} from '@shared/habitLogic'
import { getPreviousMonth, isWithinGracePeriod } from '@shared/backfillLogic'
import { HabitCell } from './HabitCell'
import { HabitScoreColumn } from './HabitScoreColumn'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { useHabitStore } from '@/lib/store/habitStore'
import { SETTING_KEYS } from '@shared/types'
import { NAME_COL_WIDTH } from './constants'

interface HabitRowProps {
  habit: Habit
  completions: HabitCompletion[]
  currentMonth: string
  daysInMonth: number
  today: string
  onToggle: (habitId: string, date: string) => void
  onEditHabit: (habit: Habit) => void
  onDeleteHabit: (habitId: string) => void
}

const DRAG_HANDLE_WIDTH = 28

const HabitRowInner = ({
  habit,
  completions,
  currentMonth,
  daysInMonth,
  today,
  onToggle,
  onEditHabit,
  onDeleteHabit,
}: HabitRowProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const backfillEnabled = useSettingsStore((s) => s.get(SETTING_KEYS.BACKFILL_HABITS) === 'true')
  const allCompletions = useHabitStore((s) => s.allCompletions)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: habit.id })

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
    position: 'relative',
  }

  const completedDates = useMemo(
    () => buildCompletionSet(completions, habit.id),
    [completions, habit.id]
  )
  const score = useMemo(
    () => computeScore(habit.schedule, completedDates, currentMonth),
    [habit.schedule, completedDates, currentMonth]
  )
  // Full history (not just the viewed month) so streaks carry over month boundaries
  const streakCompletedDates = useMemo(
    () => buildCompletionSet(allCompletions, habit.id),
    [allCompletions, habit.id]
  )
  const streak = useMemo(
    () => computeStreak(habit.schedule, streakCompletedDates, { backfillEnabled }),
    [habit.schedule, streakCompletedDates, backfillEnabled]
  )
  // Full-month applicable days — denominator for score display
  const applicableDays = useMemo(
    () => getApplicableDays(habit.schedule, currentMonth),
    [habit.schedule, currentMonth]
  )

  const todayMonth = today.slice(0, 7)
  const isCurrentMonth = currentMonth === todayMonth
  const isGraceEligible =
    backfillEnabled &&
    currentMonth === getPreviousMonth(todayMonth) &&
    isWithinGracePeriod(currentMonth)
  const allowPastDays = backfillEnabled && (isCurrentMonth || isGraceEligible)

  const handleToggle = useCallback(
    (dateStr: string) => {
      onToggle(habit.id, dateStr)
    },
    [habit.id, onToggle]
  )

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    setShowDeleteConfirm(false)
    onDeleteHabit(habit.id)
  }, [onDeleteHabit, habit.id])

  const days = useMemo(() => {
    const cells: React.ReactNode[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentMonth}-${String(d).padStart(2, '0')}`
      const isApplicable = isApplicableDay(habit.schedule, dateStr)
      const isDone = completedDates.has(dateStr)
      const isToday = dateStr === today

      let state: 'filled' | 'empty' | 'disabled'
      if (!isApplicable) state = 'disabled'
      else if (isDone) state = 'filled'
      else state = 'empty'

      cells.push(
        <HabitCell
          key={dateStr}
          dateStr={dateStr}
          today={today}
          state={state}
          isToday={isToday}
          allowPastDays={allowPastDays}
          onToggle={handleToggle}
        />
      )
    }
    return cells
  }, [daysInMonth, currentMonth, completedDates, habit.schedule, today, allowPastDays, handleToggle])

  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 30,
        borderBottom: '1px solid var(--border-subtle)',
        ...sortableStyle,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        style={{
          width: DRAG_HANDLE_WIDTH,
          minWidth: DRAG_HANDLE_WIDTH,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          color: 'var(--text-tertiary)',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 150ms',
          flexShrink: 0,
        }}
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </div>

      {/* Habit name — clickable to edit */}
      <div
        style={{
          width: NAME_COL_WIDTH - DRAG_HANDLE_WIDTH,
          minWidth: NAME_COL_WIDTH - DRAG_HANDLE_WIDTH,
          paddingRight: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => onEditHabit(habit)}
          title={habit.name}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            fontSize: 14,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            minWidth: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none'
          }}
        >
          {habit.name}
          {habit.isOptional && (
            <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>
              (opt)
            </span>
          )}
        </button>
      </div>

      {/* Day cells */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {days}
      </div>

      {/* Score column */}
      <HabitScoreColumn
        completed={score.completed}
        total={applicableDays}
        streak={streak}
      />

      {/* Hover-reveal trash icon */}
      <button
        onClick={handleDeleteClick}
        title="Delete habit"
        style={{
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          color: '#F87171',
          cursor: 'pointer',
          flexShrink: 0,
          borderRadius: 4,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 150ms, color 150ms, background-color 150ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#EF4444'
          e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#F87171'
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <Trash2 size={13} />
      </button>

      {showDeleteConfirm && (
        <ConfirmDeleteModal
          title="Delete Habit?"
          message="This will remove the habit and all its historical completion data. This cannot be undone."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}

export const HabitRow = React.memo(HabitRowInner)
HabitRow.displayName = 'HabitRow'
