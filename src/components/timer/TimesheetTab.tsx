'use client'
import React, { useMemo, useState } from 'react'
import { format, isSameMonth, isSameDay, isAfter, subMonths, addMonths, addDays } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTimerStore } from '@/lib/store/timerStore'
import { formatCurrency } from '@/lib/currency'
import { formatHoursMinutes, getMonthGridWeeks, getWeekRange, sessionElapsedNow } from '@/lib/timerFormat'
import { StatBar } from '@/components/timer/StatBar'

const BAR_GREEN = '#4ADE80'

const DAY_MS = 24 * 60 * 60 * 1000

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function TimesheetTab() {
  const { sessions, settings } = useTimerStore()

  const [viewedMonth, setViewedMonth] = useState(() => new Date())
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getWeekRange(new Date()).start)

  const nowMs = Date.now()
  const now = new Date(nowMs)

  const monthWeeks = useMemo(() => getMonthGridWeeks(viewedMonth), [viewedMonth])

  const forwardDisabled = isSameMonth(viewedMonth, now) || isAfter(viewedMonth, now)

  const handlePrevMonth = () => setViewedMonth((m) => subMonths(m, 1))
  const handleNextMonth = () => {
    if (forwardDisabled) return
    setViewedMonth((m) => addMonths(m, 1))
  }

  const handleSelectDay = (date: Date) => {
    const range = getWeekRange(date)
    setSelectedWeekStart(range.start)
    if (!isSameMonth(date, viewedMonth)) {
      setViewedMonth(date)
    }
  }

  // Days (as local-midnight timestamps) that have at least one tracked session.
  const daysWithSessions = useMemo(() => {
    const set = new Set<string>()
    for (const s of sessions) {
      set.add(format(s.createdAt, 'yyyy-MM-dd'))
    }
    return set
  }, [sessions])

  const selectedWeekRange = useMemo(() => getWeekRange(selectedWeekStart), [selectedWeekStart])

  const weekDays = useMemo(() => {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      days.push(addDays(selectedWeekRange.start, i))
    }
    return days
  }, [selectedWeekRange])

  const dayTotals = useMemo(() => {
    return weekDays.map((day) => {
      return sessions
        .filter((s) => isSameDay(s.createdAt, day))
        .reduce((sum, s) => sum + sessionElapsedNow(s, nowMs), 0)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDays, sessions, nowMs])

  const maxDayMs = Math.max(...dayTotals, 0)

  // ─── Recent transactions ───────────────────────────────────────────────

  const last7DaysAmount = useMemo(() => {
    const cutoff = nowMs - 7 * DAY_MS
    return sessions
      .filter((s) => s.createdAt >= cutoff)
      .reduce((sum, s) => sum + (sessionElapsedNow(s, nowMs) / 3600000) * s.rateSnapshot, 0)
  }, [sessions, nowMs])

  const last30DaysAmount = useMemo(() => {
    const cutoff = nowMs - 30 * DAY_MS
    return sessions
      .filter((s) => s.createdAt >= cutoff)
      .reduce((sum, s) => sum + (sessionElapsedNow(s, nowMs) / 3600000) * s.rateSnapshot, 0)
  }, [sessions, nowMs])

  const sinceStartAmount = useMemo(() => {
    return sessions.reduce((sum, s) => sum + (sessionElapsedNow(s, nowMs) / 3600000) * s.rateSnapshot, 0)
  }, [sessions, nowMs])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px' }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
        {/* Work diary — month calendar */}
        <div
          style={{
            flex: '1 1 380px',
            minWidth: 320,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button
              onClick={handlePrevMonth}
              aria-label="Previous month"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex' }}
            >
              <ChevronLeft size={18} />
            </button>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {format(viewedMonth, 'MMMM yyyy')}
            </div>
            <button
              onClick={handleNextMonth}
              disabled={forwardDisabled}
              aria-label="Next month"
              style={{
                background: 'none', border: 'none', padding: 4, display: 'flex',
                cursor: forwardDisabled ? 'not-allowed' : 'pointer',
                color: forwardDisabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                opacity: forwardDisabled ? 0.5 : 1,
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 0' }}>
                {label}
              </div>
            ))}
          </div>

          {monthWeeks.map((week, weekIdx) => {
            const isSelectedWeek = isSameDay(week[0].date, selectedWeekStart)
            return (
              <div key={weekIdx} style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {isSelectedWeek && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 'calc(100% / 14)',
                      right: 'calc(100% / 14)',
                      height: 28,
                      transform: 'translateY(-50%)',
                      backgroundColor: 'var(--bg-surface-2)',
                      borderRadius: 14,
                      zIndex: 0,
                    }}
                  />
                )}
                {week.map(({ date, inMonth }) => {
                  const key = format(date, 'yyyy-MM-dd')
                  const hasSession = daysWithSessions.has(key)
                  const isWeekEndpoint = isSelectedWeek && (isSameDay(date, week[0].date) || isSameDay(date, week[6].date))
                  return (
                    <div
                      key={key}
                      onClick={() => handleSelectDay(date)}
                      style={{
                        position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', padding: '4px 0',
                        cursor: 'pointer', userSelect: 'none',
                      }}
                    >
                      <div
                        style={{
                          width: 28, height: 28, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13,
                          backgroundColor: isWeekEndpoint ? 'var(--text-primary)' : 'transparent',
                          color: isWeekEndpoint ? 'var(--bg-surface)' : inMonth ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        }}
                      >
                        {format(date, 'd')}
                      </div>
                      <div style={{ height: 6, marginTop: 2 }}>
                        {hasSession && (
                          <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
            Tracked
          </div>
        </div>

        {/* Day-by-day breakdown */}
        <div
          style={{
            flex: '1 1 380px',
            minWidth: 320,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            {format(selectedWeekRange.start, 'MMM d')} - {format(selectedWeekRange.end, 'MMM d')}
          </div>

          {weekDays.map((day, idx) => {
            const dayMs = dayTotals[idx]
            const widthPct = maxDayMs === 0 ? 0 : (dayMs / maxDayMs) * 100
            const isFuture = isAfter(day, now)
            const labelColor = isFuture ? 'var(--text-tertiary)' : 'var(--text-primary)'
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 92, fontSize: 13, color: labelColor, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {format(day, 'd EEEE')}
                </div>
                <div
                  style={{
                    flex: 1, height: 10, borderRadius: 5, backgroundColor: 'var(--bg-surface-2)',
                    opacity: isFuture ? 0.5 : 1, overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${widthPct}%`, height: '100%', borderRadius: 5,
                      backgroundColor: BAR_GREEN,
                    }}
                  />
                </div>
                <div style={{ width: 80, textAlign: 'right', fontSize: 13, color: labelColor, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {formatHoursMinutes(dayMs)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent transactions */}
      <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        Recent transactions
      </h3>
      <StatBar
        cards={[
          { label: 'Last 7 days', value: formatCurrency(settings?.currency, last7DaysAmount) },
          { label: 'Last 30 days', value: formatCurrency(settings?.currency, last30DaysAmount) },
          { label: 'Since start', value: formatCurrency(settings?.currency, sinceStartAmount) },
        ]}
      />
    </div>
  )
}
