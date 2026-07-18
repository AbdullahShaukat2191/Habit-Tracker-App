'use client'
import React, { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import type { MonthlyReport } from '@shared/types'

interface MonthStats {
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

const TIER_NAMES: Record<number, { name: string; description: string }> = {
  1: { name: 'Reset', description: 'Hardest month is the next one — show up tomorrow.' },
  2: { name: 'Stirring', description: "Something's moving. Stack the next week." },
  3: { name: 'Building', description: "You're past the easy quitter zone." },
  4: { name: 'Climbing', description: "Most people don't get here. Keep pressing." },
  5: { name: 'Crushing', description: "This is the operator zone. Don't ease off." },
  6: { name: 'Untouchable', description: 'Top 1% behavior. Now make it boring.' },
}

const TIER_ROMAN: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
}

const defaultEmptyStats: MonthStats = {
  month: '',
  overallPct: 0,
  tier: 1,
  habitScores: [],
  bestHabit: null,
  worstHabit: null,
  longestStreak: 0,
  tasksCompleted: 0,
  tasksByProject: {},
  prevMonthPct: null,
  prevMonthTaskCount: null,
}

interface MonthlyReportCardProps {
  report: MonthlyReport
}

export function MonthlyReportCard({ report }: MonthlyReportCardProps) {
  const stats: MonthStats = useMemo((): MonthStats => {
    try {
      const parsed = JSON.parse(report.statsJson) as Partial<MonthStats>
      return {
        month: parsed.month ?? report.month,
        overallPct: parsed.overallPct ?? 0,
        tier: parsed.tier ?? 1,
        habitScores: parsed.habitScores ?? [],
        bestHabit: parsed.bestHabit ?? null,
        worstHabit: parsed.worstHabit ?? null,
        longestStreak: parsed.longestStreak ?? 0,
        tasksCompleted: parsed.tasksCompleted ?? 0,
        tasksByProject: parsed.tasksByProject ?? {},
        prevMonthPct: parsed.prevMonthPct ?? null,
        prevMonthTaskCount: parsed.prevMonthTaskCount ?? null,
      }
    } catch {
      return {
        month: report.month, overallPct: 0, tier: 1, habitScores: [],
        bestHabit: null, worstHabit: null, longestStreak: 0, tasksCompleted: 0,
        tasksByProject: {}, prevMonthPct: null, prevMonthTaskCount: null,
      }
    }
  }, [report.statsJson, report.month])

  const tierInfo = TIER_NAMES[report.tier] ?? TIER_NAMES[1]
  const tierRoman = TIER_ROMAN[report.tier] ?? 'I'

  // Parse month heading: 'yyyy-MM' → 'MMMM yyyy'
  let monthHeading = report.month
  try {
    monthHeading = format(parseISO(`${report.month}-01`), 'MMMM yyyy')
  } catch {
    // keep raw
  }

  const prevPct = stats.prevMonthPct
  const prevTaskCount = stats.prevMonthTaskCount

  let comparisonNode: React.ReactNode = null
  if (prevPct !== null) {
    const delta = report.completionPct - prevPct
    let habitText: React.ReactNode
    if (delta > 0) {
      habitText = (
        <span style={{ color: '#A7F3D0' }}>
          ↑ {delta.toFixed(1)}% vs last month
        </span>
      )
    } else if (delta < 0) {
      habitText = (
        <span style={{ color: '#F87171' }}>
          ↓ {Math.abs(delta).toFixed(1)}% vs last month
        </span>
      )
    } else {
      habitText = <span>Same as last month ({prevPct.toFixed(1)}%)</span>
    }

    let taskText: React.ReactNode = null
    if (prevTaskCount !== null) {
      const taskDelta = stats.tasksCompleted - prevTaskCount
      taskText = (
        <span>
          {' · '}
          {stats.tasksCompleted} tasks ({taskDelta >= 0 ? '+' : ''}
          {taskDelta} vs last month)
        </span>
      )
    }

    comparisonNode = (
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 12,
          marginTop: 12,
          fontSize: 12,
          color: 'var(--text-tertiary)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
        }}
      >
        {habitText}
        {taskText}
      </div>
    )
  }

  const showWorstHabit =
    stats.worstHabit !== null && stats.worstHabit !== stats.bestHabit

  return (
    <div
      style={{
        padding: 24,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Tier badge pill */}
        <span
          style={{
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent)',
            borderRadius: 20,
            padding: '3px 12px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            whiteSpace: 'nowrap',
          }}
        >
          Tier {tierRoman} · {tierInfo.name}
        </span>

        {/* Month heading */}
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {monthHeading} Monthly Report
        </h3>
      </div>

      {/* Narrative */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 16,
          marginTop: 16,
          fontSize: 14,
          lineHeight: 1.7,
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
        }}
      >
        {report.narrative}
      </div>

      {/* Stats grid */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 16,
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px 24px',
        }}
      >
        <StatItem label="Overall" value={`${report.completionPct.toFixed(1)}%`} />
        <StatItem label="Longest Streak" value={`${stats.longestStreak} days`} />
        <StatItem label="Best Habit" value={stats.bestHabit ?? 'N/A'} />
        <StatItem label="Tasks Done" value={String(stats.tasksCompleted)} />
        {showWorstHabit && (
          <StatItem label="Worst Habit" value={stats.worstHabit ?? 'N/A'} />
        )}
      </div>

      {/* Comparison row */}
      {comparisonNode}
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--text-primary)',
          fontWeight: 500,
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  )
}
