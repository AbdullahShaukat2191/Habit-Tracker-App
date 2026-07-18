'use client'
import { useEffect, useLayoutEffect, useCallback, useState, useMemo } from 'react'
import { format, addMonths, subMonths } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { useHabitStore } from '@/lib/store/habitStore'
import { HabitGrid } from '@/components/habit-grid/HabitGrid'
import { HabitModal } from '@/components/habit-grid/HabitModal'
import { PerfectDayDialog } from '@/components/habit-grid/PerfectDayDialog'
import { MonthlyReportCard } from '@/components/habit-grid/MonthlyReportCard'
import type { Habit, DayAbbreviation, MonthlyReport } from '@shared/types'
import * as ipc from '@/lib/ipc'

export default function HabitScorecardPage() {
  const habits = useHabitStore((s) => s.habits)
  const completions = useHabitStore((s) => s.completions)
  const currentMonth = useHabitStore((s) => s.currentMonth)
  const setCurrentMonth = useHabitStore((s) => s.setCurrentMonth)
  const toggleCompletion = useHabitStore((s) => s.toggleCompletion)
  const loadHabits = useHabitStore((s) => s.loadHabits)
  const loadCompletions = useHabitStore((s) => s.loadCompletions)
  const createHabit = useHabitStore((s) => s.createHabit)
  const updateHabit = useHabitStore((s) => s.updateHabit)
  const deleteHabit = useHabitStore((s) => s.deleteHabit)
  const reorderHabits = useHabitStore((s) => s.reorderHabits)

  // Never compute today during SSR — always derive from the renderer's local clock,
  // exactly like Sidebar does. Refreshes at midnight if the app is left open overnight.
  const [today, setToday] = useState('')

  useLayoutEffect(() => {
    const computeToday = () => format(new Date(), 'yyyy-MM-dd')
    setToday(computeToday())
    const scheduleRefresh = (): ReturnType<typeof setTimeout> => {
      const now = new Date()
      const msUntilMidnight =
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 500
      return setTimeout(() => {
        setToday(computeToday())
        timerId = scheduleRefresh()
      }, msUntilMidnight)
    }
    let timerId = scheduleRefresh()
    return () => clearTimeout(timerId)
  }, [])

  const thisMonth = today.slice(0, 7)

  // Show only active habits for current month; for past months show habits that existed during that month
  const visibleHabits = useMemo(() => {
    if (currentMonth === thisMonth) {
      return habits.filter((h) => h.archivedAt === null)
    }
    const [year, month] = currentMonth.split('-').map(Number)
    const monthEnd = new Date(year, month, 1).getTime() - 1 // last ms of the month
    return habits.filter((h) => {
      if (h.archivedAt !== null) return false // never show deleted habits
      if (h.createdAt > monthEnd) return false // created after this month ended
      return true
    })
  }, [habits, currentMonth, thisMonth])

  // Track slide direction: 'left' = going forward (next month), 'right' = going back (prev month)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left')

  // Modal state
  const [modalState, setModalState] = useState<
    | { type: 'add' }
    | { type: 'edit'; habit: Habit }
    | null
  >(null)

  // Monthly report state
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [isReportExpanded, setIsReportExpanded] = useState(true)

  // Auto-expand whenever a fresh report loads
  useEffect(() => {
    if (report) setIsReportExpanded(true)
  }, [report])

  // Perfect day dialog
  const [showPerfectDayDialog, setShowPerfectDayDialog] = useState(false)
  const handlePerfectDay = useCallback(() => setShowPerfectDayDialog(true), [])

  // Load data on mount
  useEffect(() => {
    loadHabits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload completions when month changes
  useEffect(() => {
    loadCompletions(currentMonth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth])

  // Load monthly report when viewing a past month
  useEffect(() => {
    if (currentMonth >= thisMonth) {
      setReport(null)
      return
    }
    ipc.getReport(currentMonth).then((r) => setReport(r)).catch(() => {})
  }, [currentMonth, thisMonth])

  // Listen for open-add-modal custom event (from Ctrl+N global shortcut)
  useEffect(() => {
    const handler = () => setModalState({ type: 'add' })
    window.addEventListener('open-add-modal', handler)
    return () => window.removeEventListener('open-add-modal', handler)
  }, [])

  const handlePrevMonth = useCallback(() => {
    const [year, month] = currentMonth.split('-').map(Number)
    const prev = subMonths(new Date(year, month - 1, 1), 1)
    setSlideDirection('right')
    setCurrentMonth(format(prev, 'yyyy-MM'))
  }, [currentMonth, setCurrentMonth])

  const handleNextMonth = useCallback(() => {
    const [year, month] = currentMonth.split('-').map(Number)
    const next = addMonths(new Date(year, month - 1, 1), 1)
    setSlideDirection('left')
    setCurrentMonth(format(next, 'yyyy-MM'))
  }, [currentMonth, setCurrentMonth])

  const handleGoToToday = useCallback(() => {
    setSlideDirection(currentMonth < thisMonth ? 'left' : 'right')
    setCurrentMonth(thisMonth)
  }, [currentMonth, thisMonth, setCurrentMonth])

  const handleToggle = useCallback(
    (habitId: string, date: string) => {
      toggleCompletion(habitId, date)
    },
    [toggleCompletion]
  )

  const handleEditHabit = useCallback((habit: Habit) => {
    setModalState({ type: 'edit', habit })
  }, [])

  const handleReorder = useCallback(
    (ids: string[]) => {
      reorderHabits(ids)
    },
    [reorderHabits]
  )

  const handleDeleteHabit = useCallback(
    (id: string) => {
      deleteHabit(id)
    },
    [deleteHabit]
  )

  const handleModalSave = useCallback(
    async (name: string, schedule: DayAbbreviation[], isOptional: boolean) => {
      if (modalState?.type === 'add') {
        await createHabit(name, schedule, isOptional)
      } else if (modalState?.type === 'edit') {
        await updateHabit(modalState.habit.id, name, schedule, isOptional)
      }
    },
    [modalState, createHabit, updateHabit]
  )

  const handleModalDelete = useCallback(async () => {
    if (modalState?.type === 'edit') {
      await deleteHabit(modalState.habit.id)
    }
  }, [modalState, deleteHabit])

  const handleModalClose = useCallback(() => {
    setModalState(null)
  }, [])

  // Display month heading — e.g. "June 2026"
  const [year, monthNum] = currentMonth.split('-').map(Number)
  const monthHeading = format(new Date(year, monthNum - 1, 1), 'MMMM yyyy')

  const isAtCurrentOrFutureMonth =
    currentMonth >= thisMonth // disable Next when already at/beyond current month

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
        maxWidth: 1400,
        width: '100%',
        margin: '0 auto',
        paddingLeft: 10,
        paddingRight: 32,
        position: 'relative',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 0',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          gap: 8,
        }}
      >
        {/* Far left: prev month arrow */}
        <button
          onClick={handlePrevMonth}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            transition: 'border-color 150ms, color 150ms',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
          }}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>

        {/* Left flex area — page title keeps month heading centered */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            Habit Scorecard
          </h2>
        </div>

        {/* Center: month heading */}
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          {monthHeading}
        </h2>

        {/* Right: Add Habit (current month) OR Today (past month) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {currentMonth === thisMonth ? (
            <button
              onClick={() => setModalState({ type: 'add' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid var(--accent)',
                backgroundColor: 'transparent',
                color: 'var(--accent)',
                fontSize: 14,
                fontWeight: 500,
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-soft)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
              }}
              aria-label="Add habit"
            >
              + Add Habit
            </button>
          ) : (
            <button
              onClick={handleGoToToday}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid var(--accent)',
                backgroundColor: 'transparent',
                color: 'var(--accent)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-soft)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              ↩ Today
            </button>
          )}
        </div>

        {/* Far right: next month arrow */}
        <button
          onClick={handleNextMonth}
          disabled={isAtCurrentOrFutureMonth}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'transparent',
            color: isAtCurrentOrFutureMonth ? 'var(--text-tertiary)' : 'var(--text-secondary)',
            opacity: isAtCurrentOrFutureMonth ? 0.4 : 1,
            cursor: isAtCurrentOrFutureMonth ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'border-color 150ms, color 150ms',
          }}
          onMouseEnter={(e) => {
            if (!isAtCurrentOrFutureMonth) {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isAtCurrentOrFutureMonth) {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            }
          }}
          aria-label="Next month"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Grid area */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
        <HabitGrid
          habits={visibleHabits}
          completions={completions}
          currentMonth={currentMonth}
          slideDirection={slideDirection}
          today={today}
          onToggle={handleToggle}
          onReorder={handleReorder}
          onEditHabit={handleEditHabit}
          onDeleteHabit={handleDeleteHabit}
          onPerfectDay={handlePerfectDay}
        />
      </div>

      {/* Monthly report overlay — slides up from bottom over the grid (past months only) */}
      <AnimatePresence>
        {report && currentMonth < thisMonth && (
          <motion.div
            key={report.month}
            initial={{ y: '100%' }}
            animate={{ y: isReportExpanded ? '0%' : 'calc(100% - 44px)' }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              maxHeight: 'calc(100% - 60px)',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '14px 14px 0 0',
              borderTop: '1px solid var(--border-subtle)',
              borderLeft: '1px solid var(--border-subtle)',
              borderRight: '1px solid var(--border-subtle)',
              boxShadow: '0 -6px 32px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Leaflet tab handle — centered at top of panel */}
            <button
              onClick={() => setIsReportExpanded((v) => !v)}
              style={{
                height: 44,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                width: '100%',
                borderRadius: '14px 14px 0 0',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <div style={{ width: 36, height: 4, backgroundColor: 'var(--border-strong)', borderRadius: 2 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {isReportExpanded
                  ? <ChevronDown size={13} strokeWidth={2} />
                  : <ChevronUp size={13} strokeWidth={2} />}
                <span>Monthly Report</span>
              </div>
            </button>

            {/* Scrollable report content */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <MonthlyReportCard report={report} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Perfect day dialog */}
      <AnimatePresence>
        {showPerfectDayDialog && (
          <PerfectDayDialog onClose={() => setShowPerfectDayDialog(false)} />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {modalState?.type === 'add' && (
          <HabitModal
            key="modal-add"
            mode="add"
            onSave={handleModalSave}
            onClose={handleModalClose}
          />
        )}
        {modalState?.type === 'edit' && (
          <HabitModal
            key="modal-edit"
            mode="edit"
            habit={modalState.habit}
            onSave={handleModalSave}
            onDelete={handleModalDelete}
            onClose={handleModalClose}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
