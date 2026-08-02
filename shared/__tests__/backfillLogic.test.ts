import {
  getPreviousMonth,
  getGraceDeadline,
  isWithinGracePeriod,
  getGraceRemainingMs,
} from '../backfillLogic'

describe('getPreviousMonth', () => {
  test('returns the prior month within the same year', () => {
    expect(getPreviousMonth('2026-08')).toBe('2026-07')
  })

  test('rolls back across a year boundary', () => {
    expect(getPreviousMonth('2026-01')).toBe('2025-12')
  })
})

describe('getGraceDeadline', () => {
  test('is midnight local on the 2nd of the following month', () => {
    const deadline = getGraceDeadline('2026-07')
    expect(deadline.getFullYear()).toBe(2026)
    expect(deadline.getMonth()).toBe(7) // August, 0-indexed
    expect(deadline.getDate()).toBe(2)
    expect(deadline.getHours()).toBe(0)
    expect(deadline.getMinutes()).toBe(0)
  })

  test('rolls into the next year for a December month', () => {
    const deadline = getGraceDeadline('2026-12')
    expect(deadline.getFullYear()).toBe(2027)
    expect(deadline.getMonth()).toBe(0) // January
    expect(deadline.getDate()).toBe(2)
  })
})

describe('isWithinGracePeriod', () => {
  test('true right after month rollover', () => {
    const justAfterRollover = new Date(2026, 7, 1, 0, 5, 0) // Aug 1, 00:05
    expect(isWithinGracePeriod('2026-07', justAfterRollover)).toBe(true)
  })

  test('true just before the deadline', () => {
    const justBefore = new Date(2026, 7, 1, 23, 59, 59)
    expect(isWithinGracePeriod('2026-07', justBefore)).toBe(true)
  })

  test('false once the deadline has passed', () => {
    const afterDeadline = new Date(2026, 7, 2, 0, 0, 1)
    expect(isWithinGracePeriod('2026-07', afterDeadline)).toBe(false)
  })

  test('false exactly at the deadline (boundary is exclusive)', () => {
    const atDeadline = new Date(2026, 7, 2, 0, 0, 0)
    expect(isWithinGracePeriod('2026-07', atDeadline)).toBe(false)
  })
})

describe('getGraceRemainingMs', () => {
  test('returns the exact remaining milliseconds within the window', () => {
    const oneHourAfterRollover = new Date(2026, 7, 1, 1, 0, 0)
    const remaining = getGraceRemainingMs('2026-07', oneHourAfterRollover)
    // Deadline is Aug 2 00:00; now is Aug 1 01:00 -> 23h remaining
    expect(remaining).toBe(23 * 60 * 60 * 1000)
  })

  test('never goes negative once the deadline has passed', () => {
    const wellAfter = new Date(2026, 8, 1) // a month past the deadline
    expect(getGraceRemainingMs('2026-07', wellAfter)).toBe(0)
  })
})
