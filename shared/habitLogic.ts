// Pure habit logic — used by both Electron main process and Next.js renderer.
// No Node.js or Electron imports allowed here.

import type { DayAbbreviation, HabitCompletion } from './types'
import { getDaysInMonth, format, addDays } from 'date-fns'
import { isDayStillEditable } from './backfillLogic'

const DAY_INDEX_MAP: Record<number, DayAbbreviation> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
}

export function isApplicableDay(schedule: DayAbbreviation[], dateStr: string): boolean {
  // Use noon to avoid DST edge cases
  const d = new Date(dateStr + 'T12:00:00')
  return schedule.includes(DAY_INDEX_MAP[d.getDay()])
}

export function computeScore(
  schedule: DayAbbreviation[],
  completedDates: Set<string>,
  month: string // 'YYYY-MM'
): { completed: number; applicable: number } {
  const [year, monthNum] = month.split('-').map(Number)
  const days = getDaysInMonth(new Date(year, monthNum - 1))
  const today = format(new Date(), 'yyyy-MM-dd')

  let completed = 0
  let applicable = 0

  for (let d = 1; d <= days; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`
    if (dateStr > today) break
    if (!isApplicableDay(schedule, dateStr)) continue
    applicable++
    if (completedDates.has(dateStr)) completed++
  }

  return { completed, applicable }
}

export interface ComputeStreakOptions {
  now?: Date
  // When true, a day only breaks the streak once it's permanently locked (its month
  // has ended and its backfill grace window has closed) — not merely because you
  // haven't gotten around to it yet. Defaults to false, which preserves the original
  // behavior: only "today" gets a pass.
  backfillEnabled?: boolean
}

export function computeStreak(
  schedule: DayAbbreviation[],
  completedDates: Set<string>,
  options: ComputeStreakOptions = {}
): number {
  const now = options.now ?? new Date()
  const backfillEnabled = options.backfillEnabled ?? false
  const todayStr = format(now, 'yyyy-MM-dd')

  let streak = 0
  let cursor = now
  let iterations = 0

  while (streak <= 365 && iterations < 800) {
    iterations++
    const dateStr = format(cursor, 'yyyy-MM-dd')

    // Skip non-scheduled days — they never break a streak
    if (!isApplicableDay(schedule, dateStr)) {
      cursor = addDays(cursor, -1)
      continue
    }

    if (completedDates.has(dateStr)) {
      streak++
      cursor = addDays(cursor, -1)
      continue
    }

    // Not completed — if there's still a chance to fill it in, don't count it as a
    // miss yet, just move on without breaking the streak.
    if (isDayStillEditable(dateStr, todayStr, backfillEnabled, now)) {
      cursor = addDays(cursor, -1)
      continue
    }

    // Permanently missed — streak is broken
    break
  }

  return streak
}

export function missedYesterday(
  schedule: DayAbbreviation[],
  completedDates: Set<string>
): boolean {
  const yesterday = addDays(new Date(), -1)
  const yesterdayStr = format(yesterday, 'yyyy-MM-dd')
  if (!isApplicableDay(schedule, yesterdayStr)) return false
  return !completedDates.has(yesterdayStr)
}

// Returns the total number of applicable days for a habit in a full calendar month.
// Does NOT stop at today — use this for denominators in score displays.
export function getApplicableDays(
  schedule: DayAbbreviation[],
  month: string // 'YYYY-MM'
): number {
  const [year, monthNum] = month.split('-').map(Number)
  const days = getDaysInMonth(new Date(year, monthNum - 1))
  let count = 0
  for (let d = 1; d <= days; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`
    if (isApplicableDay(schedule, dateStr)) count++
  }
  return count
}

export function buildCompletionSet(
  completions: HabitCompletion[],
  habitId: string
): Set<string> {
  return new Set(
    completions.filter((c) => c.habitId === habitId).map((c) => c.date)
  )
}
