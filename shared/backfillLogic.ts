// Pure backfill grace-period logic — used by both Electron main process and Next.js renderer.
// No Node.js or Electron imports allowed here.

// Returns the 'YYYY-MM' string for the calendar month immediately before `month`.
export function getPreviousMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  // monthNum is 1-indexed; monthNum - 2 lands on the previous month's 0-indexed value
  const d = new Date(year, monthNum - 2, 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// The moment `month`'s grace window closes: midnight local time on the 2nd day
// of the month following `month`.
export function getGraceDeadline(month: string): Date {
  const [year, monthNum] = month.split('-').map(Number)
  // monthNum (1-indexed for `month`) is the 0-indexed value of the *next* month
  return new Date(year, monthNum, 2, 0, 0, 0, 0)
}

export function isWithinGracePeriod(month: string, now: Date = new Date()): boolean {
  return now.getTime() < getGraceDeadline(month).getTime()
}

export function getGraceRemainingMs(month: string, now: Date = new Date()): number {
  return Math.max(0, getGraceDeadline(month).getTime() - now.getTime())
}
