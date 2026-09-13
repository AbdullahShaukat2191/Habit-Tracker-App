import { formatElapsed, formatHoursMinutes, getMonthGridWeeks, getWeekRange, sessionElapsedNow } from '../timerFormat'
import type { TimerSession } from '@shared/types'

describe('formatHoursMinutes', () => {
  test('formats zero', () => {
    expect(formatHoursMinutes(0)).toBe('0:00 hrs')
  })
  test('does not zero-pad hours', () => {
    expect(formatHoursMinutes(9 * 60 * 1000)).toBe('0:09 hrs')
  })
  test('is not capped at 24 hours', () => {
    // 334 hours 40 minutes, matching the reference screenshot's "Since start" value
    const ms = (334 * 60 + 40) * 60 * 1000
    expect(formatHoursMinutes(ms)).toBe('334:40 hrs')
  })
  test('rounds down partial minutes', () => {
    expect(formatHoursMinutes(90 * 1000)).toBe('0:01 hrs')
  })
})

describe('getWeekRange', () => {
  test('Monday-first: a Wednesday resolves to that week\'s Monday and Sunday', () => {
    // 2026-06-03 is a Wednesday
    const { start, end } = getWeekRange(new Date('2026-06-03T12:00:00'))
    expect(start.getDay()).toBe(1) // Monday
    expect(end.getDay()).toBe(0) // Sunday
    expect(start.getDate()).toBe(1)
    expect(end.getDate()).toBe(7)
  })
})

describe('getMonthGridWeeks', () => {
  test('every week has exactly 7 days', () => {
    const weeks = getMonthGridWeeks(new Date('2026-06-15T12:00:00'))
    for (const week of weeks) expect(week).toHaveLength(7)
  })
  test('first grid day is a Monday, last is a Sunday', () => {
    const weeks = getMonthGridWeeks(new Date('2026-06-15T12:00:00'))
    expect(weeks[0][0].date.getDay()).toBe(1)
    expect(weeks[weeks.length - 1][6].date.getDay()).toBe(0)
  })
  test('marks leading/trailing days from adjacent months as not in-month', () => {
    const weeks = getMonthGridWeeks(new Date('2026-06-15T12:00:00'))
    const flat = weeks.flat()
    const inMonthCount = flat.filter((d) => d.inMonth).length
    expect(inMonthCount).toBe(30) // June has 30 days
    expect(flat.some((d) => !d.inMonth)).toBe(true)
  })
})

describe('formatElapsed', () => {
  test('formats zero as 00:00:00', () => {
    expect(formatElapsed(0)).toBe('00:00:00')
  })
  test('formats a value under an hour', () => {
    // 5 minutes 9 seconds
    expect(formatElapsed(5 * 60 * 1000 + 9 * 1000)).toBe('00:05:09')
  })
  test('formats a value over an hour with zero-padded HH:MM:SS', () => {
    // 2 hours, 3 minutes, 4 seconds
    const ms = (2 * 3600 + 3 * 60 + 4) * 1000
    expect(formatElapsed(ms)).toBe('02:03:04')
  })
})

describe('sessionElapsedNow', () => {
  const baseSession: TimerSession = {
    id: 's1',
    projectId: 'p1',
    name: null,
    startedAt: 1_000_000,
    totalElapsed: 60_000,
    status: 'running',
    pausedAt: null,
    stoppedAt: null,
    createdAt: 1_000_000,
    rateSnapshot: 0,
  }

  test('running session adds now - startedAt to totalElapsed', () => {
    const now = 1_000_000 + 30_000
    expect(sessionElapsedNow(baseSession, now)).toBe(60_000 + 30_000)
  })

  test('paused/stopped session ignores now and returns totalElapsed exactly', () => {
    const pausedSession: TimerSession = { ...baseSession, status: 'paused', pausedAt: 1_050_000 }
    const now = 1_000_000 + 999_999
    expect(sessionElapsedNow(pausedSession, now)).toBe(60_000)

    const stoppedSession: TimerSession = { ...baseSession, status: 'stopped', stoppedAt: 1_050_000 }
    expect(sessionElapsedNow(stoppedSession, now)).toBe(60_000)
  })
})
