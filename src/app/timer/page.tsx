'use client'
import { useState } from 'react'
import { PageQuote } from '@/components/layout/PageQuote'
import { TimerTab } from '@/components/timer/TimerTab'
import { TimesheetTab } from '@/components/timer/TimesheetTab'

type TimerPageTab = 'timer' | 'timesheet' | 'sessions'

const TABS: { id: TimerPageTab; label: string }[] = [
  { id: 'timer', label: 'Timer' },
  { id: 'timesheet', label: 'Timesheet' },
  { id: 'sessions', label: 'Sessions' },
]

export default function TimerPage() {
  const [activeTab, setActiveTab] = useState<TimerPageTab>('timer')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
        maxWidth: 1100,
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 32px 0',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Timer</h2>
        </div>

        <PageQuote pageId="timer" />

        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                backgroundColor: activeTab === tab.id ? 'var(--bg-surface-2)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? 500 : 400,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'background-color 150ms, color 150ms',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'timer' && <TimerTab />}
      {activeTab === 'timesheet' && <TimesheetTab />}
      {activeTab === 'sessions' && <ComingSoon />}
    </div>
  )
}

// Sessions (Task 9) sub-tab doesn't exist yet — placeholder only.
function ComingSoon() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-tertiary)',
        fontSize: 14,
      }}
    >
      Coming soon
    </div>
  )
}
