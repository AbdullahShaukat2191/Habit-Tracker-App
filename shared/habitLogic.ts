// Pure habit logic — used by both Electron main process and Next.js renderer.
// No Node.js or Electron imports allowed here.

import type { DayAbbreviation, HabitCompletion } from './types'
import { getDaysInMonth, format, addDays } from 'date-fns'

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
  month: string, // 'YYYY-MM'
  createdAt?: number // epoch ms; days before this are excluded (habit didn't exist yet)
): { completed: number; applicable: number } {
  const [year, monthNum] = month.split('-').map(Number)
  const days = getDaysInMonth(new Date(year, monthNum - 1))
  const today = format(new Date(), 'yyyy-MM-dd')
  const createdDateStr = createdAt !== undefined ? format(new Date(createdAt), 'yyyy-MM-dd') : null

  let completed = 0
  let applicable = 0

  for (let d = 1; d <= days; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`
    if (dateStr > today) break
    if (createdDateStr !== null && dateStr < createdDateStr) continue
    if (!isApplicableDay(schedule, dateStr)) continue
    applicable++
    if (completedDates.has(dateStr)) completed++
  }

  return { completed, applicable }
}

export function computeStreak(
  schedule: DayAbbreviation[],
  completedDates: Set<string>,
  createdAt?: number // epoch ms; streak cannot extend before the habit existed
): number {
  let streak = 0
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const createdDateStr = createdAt !== undefined ? format(new Date(createdAt), 'yyyy-MM-dd') : null
  let cursor = new Date()

  while (streak <= 365) {
    const dateStr = format(cursor, 'yyyy-MM-dd')

    // Walked back past the habit's creation date — nothing before this counts
    if (createdDateStr !== null && dateStr < createdDateStr) break

    // Skip non-scheduled days — they never break a streak
    if (!isApplicableDay(schedule, dateStr)) {
      cursor = addDays(cursor, -1)
      continue
    }

    // Today hasn't been done yet — skip it so the streak from prior days is preserved
    if (dateStr === todayStr && !completedDates.has(dateStr)) {
      cursor = addDays(cursor, -1)
      continue
    }

    // A past scheduled day was missed — streak is broken
    if (!completedDates.has(dateStr)) break

    streak++
    cursor = addDays(cursor, -1)
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
  month: string, // 'YYYY-MM'
  createdAt?: number // epoch ms; days before this are excluded (habit didn't exist yet)
): number {
  const [year, monthNum] = month.split('-').map(Number)
  const days = getDaysInMonth(new Date(year, monthNum - 1))
  const createdDateStr = createdAt !== undefined ? format(new Date(createdAt), 'yyyy-MM-dd') : null
  let count = 0
  for (let d = 1; d <= days; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`
    if (createdDateStr !== null && dateStr < createdDateStr) continue
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
