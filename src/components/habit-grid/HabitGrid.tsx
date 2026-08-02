'use client'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getDaysInMonth } from 'date-fns'
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Habit, HabitCompletion } from '@shared/types'
import { computeScore, buildCompletionSet, getApplicableDays, isApplicableDay } from '@shared/habitLogic'
import { getPreviousMonth } from '@shared/backfillLogic'
import { HabitGridHeader } from './HabitGridHeader'
import { HabitRow } from './HabitRow'
import { GraceCountdown } from './GraceCountdown'
import { NAME_COL_WIDTH, SCORE_COL_WIDTH } from './constants'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { SETTING_KEYS } from '@shared/types'

interface HabitGridProps {
  habits: Habit[]
  completions: HabitCompletion[]
  currentMonth: string
  slideDirection: 'left' | 'right'
  today: string
  onToggle: (habitId: string, date: string) => void
  onReorder: (ids: string[]) => void
  onEditHabit: (habit: Habit) => void
  onDeleteHabit: (habitId: string) => void
  onPerfectDay?: () => void
}

const slideVariants = {
  enterFromRight: { x: '100%', opacity: 0 },
  enterFromLeft: { x: '-100%', opacity: 0 },
  center: { x: 0, opacity: 1 },
  exitToLeft: { x: '-100%', opacity: 0 },
  exitToRight: { x: '100%', opacity: 0 },
}

const TRANSITION = {
  duration: 0.35,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
}

const POINTER_SENSOR_OPTIONS = {
  activationConstraint: { distance: 5 },
}

export function HabitGrid({
  habits,
  completions,
  currentMonth,
  slideDirection,
  today,
  onToggle,
  onReorder,
  onEditHabit,
  onDeleteHabit,
  onPerfectDay,
}: HabitGridProps) {
  const [year, monthNum] = currentMonth.split('-').map(Number)
  const daysInMonth = getDaysInMonth(new Date(year, monthNum - 1))

  const sensors = useSensors(useSensor(PointerSensor, POINTER_SENSOR_OPTIONS))

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = habits.findIndex((h) => h.id === active.id)
      const newIndex = habits.findIndex((h) => h.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const newOrder = arrayMove(habits, oldIndex, newIndex)
      onReorder(newOrder.map((h) => h.id))
    },
    [habits, onReorder]
  )

  // Compute totals for monthly summary — optional habits are excluded (they don't count against the score)
  const totals = useMemo(
    () =>
      habits
        .filter((h) => !h.isOptional)
        .reduce(
          (acc, habit) => {
            const completedSet = buildCompletionSet(completions, habit.id)
            const { completed } = computeScore(habit.schedule, completedSet, currentMonth)
            // Use full-month applicable days (not capped at today) for the denominator
            const applicable = getApplicableDays(habit.schedule, currentMonth)
            acc.completed += completed
            acc.applicable += applicable
            return acc
          },
          { completed: 0, applicable: 0 }
        ),
    [habits, completions, currentMonth]
  )

  const todayMonth = today.slice(0, 7)
  const isCurrentMonth = currentMonth === todayMonth
  const backfillEnabled = useSettingsStore((s) => s.get(SETTING_KEYS.BACKFILL_HABITS) === 'true')
  const isGraceEligibleMonth =
    backfillEnabled && !isCurrentMonth && currentMonth === getPreviousMonth(todayMonth)

  // Completion lookup: habitId → Set<dateStr>
  const completionsByHabit = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of completions) {
      if (!map.has(c.habitId)) map.set(c.habitId, new Set())
      map.get(c.habitId)!.add(c.date)
    }
    return map
  }, [completions])

  // Days where every applicable active habit was completed
  const perfectDays = useMemo(() => {
    const perfect = new Set<string>()
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentMonth}-${String(d).padStart(2, '0')}`
      if (dateStr > today) continue
      const applicable = habits.filter(
        (h) => h.archivedAt === null && !h.isOptional && isApplicableDay(h.schedule, dateStr)
      )
      if (applicable.length === 0) continue
      if (applicable.every((h) => completionsByHabit.get(h.id)?.has(dateStr))) {
        perfect.add(dateStr)
      }
    }
    return perfect
  }, [habits, completionsByHabit, currentMonth, daysInMonth, today])

  // Fire onPerfectDay callback when today first becomes a perfect day
  const onPerfectDayRef = useRef(onPerfectDay)
  useEffect(() => { onPerfectDayRef.current = onPerfectDay }, [onPerfectDay])
  const hasFiredPerfectRef = useRef(false)
  useEffect(() => {
    const todayPerfect = isCurrentMonth && perfectDays.has(today)
    if (todayPerfect && !hasFiredPerfectRef.current) {
      hasFiredPerfectRef.current = true
      onPerfectDayRef.current?.()
    }
    if (!todayPerfect) hasFiredPerfectRef.current = false
  }, [perfectDays, today, isCurrentMonth])

  // Top 3 habits by completion rate this month
  const topHabits = useMemo(() => {
    return habits
      .filter((h) => h.archivedAt === null)
      .map((habit) => {
        const completedSet = buildCompletionSet(completions, habit.id)
        const { completed } = computeScore(habit.schedule, completedSet, currentMonth)
        const applicable = getApplicableDays(habit.schedule, currentMonth)
        const pct = applicable > 0 ? completed / applicable : 0
        return { id: habit.id, name: habit.name, completed, applicable, pct }
      })
      .filter((h) => h.applicable > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3)
  }, [habits, completions, currentMonth])

  // Daily progress for today's habits (current month only) — optional habits excluded from count
  const todayProgress = useMemo(() => {
    if (!isCurrentMonth) return []
    const todayDoneSet = new Set(completions.filter((c) => c.date === today).map((c) => c.habitId))
    return habits
      .filter((h) => h.archivedAt === null && !h.isOptional && isApplicableDay(h.schedule, today))
      .map((h) => ({ id: h.id, name: h.name, done: todayDoneSet.has(h.id) }))
  }, [habits, completions, today, isCurrentMonth])

  const enterVariant = slideDirection === 'left' ? 'enterFromRight' : 'enterFromLeft'
  const exitVariant = slideDirection === 'left' ? 'exitToLeft' : 'exitToRight'

  const habitIds = habits.map((h) => h.id)

  return (
    <div style={{ position: 'relative', overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentMonth}
          variants={slideVariants}
          initial={enterVariant}
          animate="center"
          exit={exitVariant}
          transition={TRANSITION}
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          {/* Horizontally scrollable grid */}
          <div style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'auto' }}>
            <div
              style={{
                minWidth: `calc(${NAME_COL_WIDTH}px + 31 * var(--cell-size) + ${SCORE_COL_WIDTH}px)`,
              }}
            >
              <HabitGridHeader
                daysInMonth={daysInMonth}
                currentMonth={currentMonth}
                today={today}
                perfectDays={perfectDays}
              />

              {habits.length === 0 ? (
                <div
                  style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    fontSize: 14,
                  }}
                >
                  No habits yet. Click &quot;+ Add Habit&quot; to get started.
                </div>
              ) : (
                <div style={{ paddingBottom: 8 }}>
                  <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <SortableContext items={habitIds} strategy={verticalListSortingStrategy}>
                      {habits.map((habit) => (
                        <HabitRow
                          key={habit.id}
                          habit={habit}
                          completions={completions}
                          currentMonth={currentMonth}
                          daysInMonth={daysInMonth}
                          today={today}
                          onToggle={onToggle}
                          onEditHabit={onEditHabit}
                          onDeleteHabit={onDeleteHabit}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}

              {/* Two-column footer: Daily Progress (left) + Monthly Progress (right) */}
              {habits.length > 0 && (
                <div style={{ display: 'flex', borderTop: '1px solid var(--border-strong)' }}>
                  {/* Left: Daily Progress */}
                  <div style={{ flex: 1, padding: '12px 16px' }}>
                    {/* Heading pinned left, counter centered in the full panel width */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, minHeight: 20 }}>
                      <div style={{ position: 'absolute', left: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Daily Progress
                      </div>
                      {isCurrentMonth && todayProgress.length > 0 && (
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {todayProgress.filter((h) => h.done).length}/{todayProgress.length} Done
                        </div>
                      )}
                    </div>
                    {isCurrentMonth ? (
                      todayProgress.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                          No habits scheduled for today
                        </div>
                      ) : (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {todayProgress.map((h) => (
                            <li key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: h.done ? '#34D399' : 'var(--text-tertiary)', flexShrink: 0, lineHeight: 1 }}>
                                {h.done ? '✓' : '○'}
                              </span>
                              <span style={{ color: h.done ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                {h.name}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : isGraceEligibleMonth ? (
                      <GraceCountdown month={currentMonth} />
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Past month — read only</div>
                    )}
                  </div>

                  {/* Thin vertical divider with top/bottom margin */}
                  <div style={{ width: 1, backgroundColor: '#E5E7EB', margin: '10px 0', flexShrink: 0 }} />

                  {/* Right: Monthly Progress - Total Completed */}
                  <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                      Monthly Progress - Total Completed
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 0, marginBottom: 12 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {totals.completed}/{totals.applicable}
                      </span>
                      {totals.applicable > 0 && (
                        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginLeft: 8 }}>
                          - {Math.round((totals.completed / totals.applicable) * 100)}%
                        </span>
                      )}
                    </div>
                    {topHabits.length > 0 && (
                      <div style={{ width: '100%' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                          Your Top 3 Habits
                        </div>
                        {topHabits.map((h, i) => (
                          <div key={h.id} style={{ marginBottom: 7, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', flexShrink: 0, width: 12, textAlign: 'right' }}>
                              {i + 1}.
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
                                  {h.name}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                  {h.completed}/{h.applicable} - {Math.round(h.pct * 100)}%
                                </span>
                              </div>
                              <div style={{ height: 5, backgroundColor: 'var(--bg-surface-2)', borderRadius: 3 }}>
                                <div style={{ height: '100%', width: `${Math.round(h.pct * 100)}%`, backgroundColor: 'var(--accent)', borderRadius: 3, transition: 'width 300ms ease' }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
