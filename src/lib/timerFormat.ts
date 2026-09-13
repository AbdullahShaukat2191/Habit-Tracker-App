import { format, formatDistanceToNow, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, isSameMonth } from 'date-fns'
import type { TimerSession } from '@shared/types'

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

// Uncapped hours (no 24h wrap), zero-padded minutes only — e.g. "334:40 hrs", "0:00 hrs".
export function formatHoursMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}:${String(minutes).padStart(2, '0')} hrs`
}

export function formatRelativeAgo(timestampMs: number): string {
  return formatDistanceToNow(timestampMs, { addSuffix: true })
}

export function formatSessionTimestamp(ms: number, includeDate: boolean): string {
  return includeDate ? format(ms, 'MMM d, h:mm a') : format(ms, 'h:mm a')
}

export function getWeekRange(date: Date) {
  return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) }
}

// Monday-first grid of full weeks covering the given month, including leading/trailing
// days from adjacent months so every row has 7 days.
export function getMonthGridWeeks(monthDate: Date): { date: Date; inMonth: boolean }[][] {
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: { date: Date; inMonth: boolean }[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    days.push({ date: cursor, inMonth: isSameMonth(cursor, monthDate) })
    cursor = addDays(cursor, 1)
  }

  const weeks: { date: Date; inMonth: boolean }[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

// A running session's contribution keeps ticking up live; paused/stopped sessions
// are already frozen at their stored totalElapsed.
export function sessionElapsedNow(session: TimerSession, now: number): number {
  if (session.status === 'running') return session.totalElapsed + (now - session.startedAt)
  return session.totalElapsed
}
