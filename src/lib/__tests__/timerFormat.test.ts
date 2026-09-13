import { formatHoursMinutes, getMonthGridWeeks, getWeekRange } from '../timerFormat'

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
