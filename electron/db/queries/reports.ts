import { eq } from 'drizzle-orm'
import { getDb } from '../client'
import { monthlyReports, habits, habitCompletions, tasks, projects } from '../schema'
import type { MonthlyReport } from '../../../shared/types'
import { listHabits, getHabitCompletions } from './habits'
import { computeScore, computeStreak } from '../../../shared/habitLogic'
import { randomUUID } from 'crypto'
import { getDaysInMonth, format, subMonths, startOfMonth } from 'date-fns'

function rowToReport(row: typeof monthlyReports.$inferSelect): MonthlyReport {
  return {
    id: row.id,
    month: row.month,
    generatedAt: row.generatedAt,
    tier: row.tier,
    completionPct: row.completionPct,
    narrative: row.narrative,
    statsJson: row.statsJson,
  }
}

export function getReport(month: string): MonthlyReport | null {
  const db = getDb()
  const row = db.select().from(monthlyReports).where(eq(monthlyReports.month, month)).get()
  return row ? rowToReport(row) : null
}

export interface MonthStats {
  month: string
  overallPct: number
  tier: number
  habitScores: Array<{ habitId: string; name: string; completed: number; applicable: number; pct: number }>
  bestHabit: string | null
  worstHabit: string | null
  longestStreak: number
  tasksCompleted: number
  tasksByProject: Record<string, { name: string; count: number }>
  prevMonthPct: number | null
  prevMonthTaskCount: number | null
}

export function computeMonthStats(month: string): MonthStats {
  const db = getDb()
  const [year, monthNum] = month.split('-').map(Number)
  const daysInMonth = getDaysInMonth(new Date(year, monthNum - 1))

  // All non-archived habits (including ones archived after this month started)
  const allHabits = db.select().from(habits).all()
  const completions = getHabitCompletions(month)

  const completionsByHabit = new Map<string, Set<string>>()
  for (const c of completions) {
    if (!completionsByHabit.has(c.habitId)) completionsByHabit.set(c.habitId, new Set())
    completionsByHabit.get(c.habitId)!.add(c.date)
  }

  // Only count habits that existed during this month
  const monthStart = new Date(`${month}-01T12:00:00`)
  const relevantHabits = allHabits.filter((h) => {
    const created = new Date(h.createdAt)
    const archived = h.archivedAt ? new Date(h.archivedAt) : null
    return created <= new Date(`${month}-${String(daysInMonth).padStart(2, '0')}T23:59:59`) &&
           (!archived || archived >= monthStart)
  })

  const habitScores = relevantHabits.map((h) => {
    const schedule = JSON.parse(h.schedule)
    const completed = completionsByHabit.get(h.id) ?? new Set<string>()
    const score = computeScore(schedule, completed, month, h.createdAt)
    return {
      habitId: h.id,
      name: h.name,
      completed: score.completed,
      applicable: score.applicable,
      pct: score.applicable > 0 ? (score.completed / score.applicable) * 100 : 0,
    }
  }).filter((s) => s.applicable > 0)

  const totalCompleted = habitScores.reduce((sum, s) => sum + s.completed, 0)
  const totalApplicable = habitScores.reduce((sum, s) => sum + s.applicable, 0)
  const overallPct = totalApplicable > 0 ? (totalCompleted / totalApplicable) * 100 : 0

  const bestHabit = habitScores.length > 0
    ? habitScores.reduce((a, b) => a.pct >= b.pct ? a : b).name
    : null
  const worstHabit = habitScores.length > 1
    ? habitScores.reduce((a, b) => a.pct <= b.pct ? a : b).name
    : null

  // Compute longest streak achieved during the month
  let longestStreak = 0
  for (const h of relevantHabits) {
    const schedule = JSON.parse(h.schedule)
    // Compute streak as of end of month (or today if current month)
    const endDate = new Date(Math.min(
      new Date(`${month}-${String(daysInMonth).padStart(2, '0')}T12:00:00`).getTime(),
      Date.now()
    ))
    const completed = completionsByHabit.get(h.id) ?? new Set<string>()
    const streak = computeStreak(schedule, completed, h.createdAt)
    if (streak > longestStreak) longestStreak = streak
  }

  // Tasks completed during this month
  const monthStartTs = new Date(`${month}-01T00:00:00`).getTime()
  const monthEndTs = new Date(`${month}-${String(daysInMonth).padStart(2, '0')}T23:59:59`).getTime()
  const completedTasks = db.select().from(tasks).all().filter(
    (t) => t.completedAt && t.completedAt >= monthStartTs && t.completedAt <= monthEndTs
  )

  // Fetch project names for task breakdown
  const projectMap = new Map<string, string>()
  const rawProjects = db.select().from(projects).all()
  for (const p of rawProjects) projectMap.set(p.id, p.name)

  const tasksByProject: Record<string, { name: string; count: number }> = {}
  for (const t of completedTasks) {
    const key = t.projectId ?? '__none__'
    const name = t.projectId ? (projectMap.get(t.projectId) ?? 'Unknown') : 'No Project'
    if (!tasksByProject[key]) tasksByProject[key] = { name, count: 0 }
    tasksByProject[key].count++
  }

  // Previous month comparison
  const prevMonthDate = subMonths(new Date(`${month}-01`), 1)
  const prevMonth = format(prevMonthDate, 'yyyy-MM')
  const prevReport = getReport(prevMonth)
  const prevMonthPct = prevReport ? prevReport.completionPct : null

  const prevDays = getDaysInMonth(prevMonthDate)
  const prevMonthStartTs = prevMonthDate.getTime()
  const prevMonthEndTs = new Date(`${prevMonth}-${String(prevDays).padStart(2, '0')}T23:59:59`).getTime()
  const prevTaskCount = db.select().from(tasks).all().filter(
    (t) => t.completedAt && t.completedAt >= prevMonthStartTs && t.completedAt <= prevMonthEndTs
  ).length

  return {
    month,
    overallPct,
    tier: pctToTier(overallPct),
    habitScores,
    bestHabit,
    worstHabit,
    longestStreak,
    tasksCompleted: completedTasks.length,
    tasksByProject,
    prevMonthPct,
    prevMonthTaskCount: prevReport ? prevTaskCount : null,
  }
}

export function pctToTier(pct: number): number {
  if (pct <= 20) return 1
  if (pct <= 40) return 2
  if (pct <= 60) return 3
  if (pct <= 80) return 4
  if (pct <= 95) return 5
  return 6
}

export const TIER_NAMES: Record<number, { name: string; description: string }> = {
  1: { name: 'Reset', description: 'Hardest month is the next one — show up tomorrow.' },
  2: { name: 'Stirring', description: "Something's moving. Stack the next week." },
  3: { name: 'Building', description: "You're past the easy quitter zone." },
  4: { name: 'Climbing', description: "Most people don't get here. Keep pressing." },
  5: { name: 'Crushing', description: "This is the operator zone. Don't ease off." },
  6: { name: 'Untouchable', description: 'Top 1% behavior. Now make it boring.' },
}

export async function generateReport(month: string, openaiApiKey: string): Promise<MonthlyReport> {
  const db = getDb()
  const stats = computeMonthStats(month)
  let narrative = buildFallbackNarrative(stats)

  if (openaiApiKey) {
    try {
      const { default: OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey: openaiApiKey })
      const response = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: `You are a brutally honest but supportive coach in the voice of Alex Hormozi and David Goggins. Write a 3-4 sentence summary of this user's month. Acknowledge what they did well, call out what slipped, and tell them what to focus on next month. No fluff. No emojis. No bullet points. Just direct prose.`,
          },
          {
            role: 'user',
            content: `Here are the stats for ${month}: Overall completion: ${stats.overallPct.toFixed(1)}%. Best habit: ${stats.bestHabit ?? 'none'}. Worst habit: ${stats.worstHabit ?? 'none'}. Longest streak: ${stats.longestStreak} days. Tasks completed: ${stats.tasksCompleted}. Previous month completion: ${stats.prevMonthPct !== null ? stats.prevMonthPct.toFixed(1) + '%' : 'no data'}.`,
          },
        ],
      })
      const text = response.choices[0]?.message?.content
      if (text) narrative = text
    } catch (err) {
      console.error('OpenAI API failed, using fallback narrative:', err)
    }
  }

  const report = {
    id: randomUUID(),
    month,
    generatedAt: Date.now(),
    tier: stats.tier,
    completionPct: stats.overallPct,
    narrative,
    statsJson: JSON.stringify(stats),
  }

  db.insert(monthlyReports).values(report).onConflictDoUpdate({
    target: monthlyReports.month,
    set: { narrative, statsJson: report.statsJson, generatedAt: report.generatedAt },
  }).run()

  return rowToReport(db.select().from(monthlyReports).where(eq(monthlyReports.month, month)).get()!)
}

function buildFallbackNarrative(stats: MonthStats): string {
  const tierInfo = TIER_NAMES[stats.tier]
  const pct = stats.overallPct.toFixed(1)
  const best = stats.bestHabit ? `Your strongest habit was ${stats.bestHabit}.` : ''
  const worst = stats.worstHabit && stats.worstHabit !== stats.bestHabit ? `${stats.worstHabit} needs more attention.` : ''
  const comparison = stats.prevMonthPct !== null
    ? stats.overallPct >= stats.prevMonthPct
      ? `Up from ${stats.prevMonthPct.toFixed(1)}% last month — keep the momentum.`
      : `Down from ${stats.prevMonthPct.toFixed(1)}% last month — course correct now.`
    : ''
  return [
    `${tierInfo.name}: ${pct}% completion. ${tierInfo.description}`,
    best,
    worst,
    comparison,
  ].filter(Boolean).join(' ')
}
