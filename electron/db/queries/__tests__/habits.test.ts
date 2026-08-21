import { computeScore, computeStreak, isApplicableDay, missedYesterday, getApplicableDays } from '../../../../shared/habitLogic'
import { format, addDays, subDays } from 'date-fns'

// Pin "today" via a stable date in tests where needed
const TODAY = '2026-06-03'
const YESTERDAY = '2026-06-02'

// Helper to get today's date string dynamically for tests that don't pin dates
function todayStr() {
  return format(new Date(), 'yyyy-MM-dd')
}
function yesterdayStr() {
  return format(subDays(new Date(), 1), 'yyyy-MM-dd')
}

describe('isApplicableDay', () => {
  test('returns true when the day is in the schedule', () => {
    // 2026-06-01 is a Monday
    expect(isApplicableDay(['mon', 'wed', 'fri'], '2026-06-01')).toBe(true)
  })

  test('returns false when the day is not in the schedule', () => {
    // 2026-06-01 is a Monday, schedule is weekends only
    expect(isApplicableDay(['sat', 'sun'], '2026-06-01')).toBe(false)
  })

  test('returns true for sunday when sun is in schedule', () => {
    // 2026-06-07 is a Sunday
    expect(isApplicableDay(['sun'], '2026-06-07')).toBe(true)
  })

  test('daily habit applies every day', () => {
    const daily = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    expect(isApplicableDay([...daily], '2026-06-01')).toBe(true)
    expect(isApplicableDay([...daily], '2026-06-07')).toBe(true)
  })
})

describe('computeScore', () => {
  test('counts completed vs applicable days up to today', () => {
    // 2026-06 month, daily habit, completed days 1 and 2 only
    // "today" in the test is 2026-06-03, so applicable = 3 (June 1, 2, 3)
    const completed = new Set(['2026-06-01', '2026-06-02'])

    // We can't mock Date, but computeScore uses real Date.now() internally.
    // We test by passing a month that has already passed (or is in progress).
    // Use a past month for deterministic results:
    const result = computeScore(
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      completed,
      '2026-05' // May 2026 — fully past month
    )
    // May has 31 days, all applicable for a daily habit
    expect(result.applicable).toBe(31)
    expect(result.completed).toBe(0) // no completions in May
  })

  test('skips non-applicable days in score calculation', () => {
    // Weekdays-only habit for May 2026
    // May 2026: 21 weekdays (Mon-Fri)
    const allWeekdays = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
    const completed = new Set<string>()
    const result = computeScore([...allWeekdays], completed, '2026-05')
    expect(result.applicable).toBe(21) // 21 weekdays in May 2026
    expect(result.completed).toBe(0)
  })

  test('counts completed cells correctly for gym schedule (no sundays)', () => {
    // Sun excluded from gym; May 2026 has 5 Sundays
    const gymSchedule = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
    // Mark all 31 days completed (Sundays won't count)
    const allMayDays = new Set(
      Array.from({ length: 31 }, (_, i) => `2026-05-${String(i + 1).padStart(2, '0')}`)
    )
    const result = computeScore([...gymSchedule], allMayDays, '2026-05')
    expect(result.applicable).toBe(26) // 31 - 5 sundays
    expect(result.completed).toBe(26)
  })
})

describe('computeStreak', () => {
  test('returns 0 when no past days are completed', () => {
    const streak = computeStreak(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], new Set())
    expect(streak).toBe(0)
  })

  test('counts consecutive completed applicable days from yesterday backwards', () => {
    // Build a completed set with the last 5 days
    const completed = new Set<string>()
    for (let i = 1; i <= 5; i++) {
      completed.add(format(subDays(new Date(), i), 'yyyy-MM-dd'))
    }
    const streak = computeStreak(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], completed)
    expect(streak).toBe(5)
  })

  test('streak breaks on a missed applicable day', () => {
    // Complete days 1, 2, 3 back, miss day 4, complete day 5
    const completed = new Set<string>()
    for (const i of [1, 2, 3, 5]) {
      completed.add(format(subDays(new Date(), i), 'yyyy-MM-dd'))
    }
    const streak = computeStreak(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], completed)
    expect(streak).toBe(3) // breaks at the gap (day 4)
  })

  test('non-applicable days do not break streak', () => {
    // Weekday-only habit: find the last Sunday and verify skipping it doesn't break streak
    // Build 7 days of completed — skipping Sundays
    const completed = new Set<string>()
    let dayCount = 0
    let cursor = subDays(new Date(), 1)

    while (dayCount < 5) {
      const abbrev = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][cursor.getDay()]
      if (abbrev !== 'sun') {
        completed.add(format(cursor, 'yyyy-MM-dd'))
        dayCount++
      }
      cursor = subDays(cursor, 1)
    }

    const streak = computeStreak(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], completed)
    expect(streak).toBe(5)
  })
})

describe('createdAt boundary — habits should not count as missed before they existed', () => {
  test('computeScore excludes days before createdAt from the applicable count', () => {
    // Daily habit, but created May 15 — only May 15-31 (17 days) should be applicable
    const daily = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    const createdAt = new Date('2026-05-15T00:00:00').getTime()
    const result = computeScore([...daily], new Set(), '2026-05', createdAt)
    expect(result.applicable).toBe(17)
    expect(result.completed).toBe(0)
  })

  test('computeScore with no createdAt behaves as before (back-compat)', () => {
    const daily = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    const result = computeScore([...daily], new Set(), '2026-05')
    expect(result.applicable).toBe(31)
  })

  test('getApplicableDays excludes days before createdAt', () => {
    const daily = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    const createdAt = new Date('2026-05-15T00:00:00').getTime()
    expect(getApplicableDays([...daily], '2026-05', createdAt)).toBe(17)
  })

  test('getApplicableDays with no createdAt behaves as before (back-compat)', () => {
    const daily = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    expect(getApplicableDays([...daily], '2026-05')).toBe(31)
  })

  test('a habit created mid-month is not penalized for days before it existed', () => {
    // Habit created on the 15th, never completed since — without the fix this would
    // report a low score dragged down by 14 "missed" days that predate the habit.
    const daily = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    const createdAt = new Date('2026-05-15T00:00:00').getTime()
    const applicable = getApplicableDays([...daily], '2026-05', createdAt)
    expect(applicable).toBe(17) // not 31 — the 14 days before creation don't count against it
  })

  test('computeStreak ignores completions recorded before createdAt (e.g. stale backfilled data)', () => {
    // Habit "created" 2 days ago, but completedDates anomalously has entries reaching back
    // 4 days (simulating a pre-existing backfilled completion from before the habit existed).
    // The streak must not count those pre-creation days.
    const daily = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    const createdAt = subDays(new Date(), 2).getTime()
    const completed = new Set<string>()
    for (let i = 1; i <= 4; i++) {
      completed.add(format(subDays(new Date(), i), 'yyyy-MM-dd'))
    }
    const streakWithoutGuard = computeStreak([...daily], completed)
    const streakWithGuard = computeStreak([...daily], completed, createdAt)
    expect(streakWithoutGuard).toBe(4) // pre-fix behavior: counts all 4, including pre-creation days
    expect(streakWithGuard).toBe(2) // post-fix: stops at createdAt, only the 2 real days count
  })

  test('computeStreak with no createdAt behaves as before (back-compat)', () => {
    const completed = new Set<string>()
    for (let i = 1; i <= 5; i++) {
      completed.add(format(subDays(new Date(), i), 'yyyy-MM-dd'))
    }
    const streak = computeStreak(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], completed)
    expect(streak).toBe(5)
  })
})

describe('missedYesterday', () => {
  test('returns true when yesterday was applicable and not completed', () => {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const dayAbbrev = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][subDays(new Date(), 1).getDay()]
    // Schedule includes yesterday's day
    expect(missedYesterday([dayAbbrev as any], new Set())).toBe(true)
  })

  test('returns false when yesterday was completed', () => {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const dayAbbrev = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][subDays(new Date(), 1).getDay()]
    expect(missedYesterday([dayAbbrev as any], new Set([yesterday]))).toBe(false)
  })

  test('returns false when yesterday is not an applicable day', () => {
    const yesterday = subDays(new Date(), 1)
    const dayAbbrev = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][yesterday.getDay()]
    // Schedule excludes yesterday's day — use all other days
    const allDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].filter(d => d !== dayAbbrev) as any[]
    expect(missedYesterday(allDays, new Set())).toBe(false)
  })
})
