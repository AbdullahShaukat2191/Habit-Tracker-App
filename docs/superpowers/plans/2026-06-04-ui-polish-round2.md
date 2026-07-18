# UI Polish Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score column shows actual completed/total counts, TitleBar is taller with proportionally larger controls, pages are centered with a dark-framed enclosure, month nav arrows move adjacent to the month name, font sizes increase slightly, and disabled habit cells are darkened.

**Architecture:** All changes are renderer-only. Color/layout changes flow through `src/styles/globals.css` tokens and inline styles. Content centering is applied at the page level (maxWidth + margin: auto on outer page divs). The dark "frame" effect comes from giving `<main>` a dark background with padding so the background peeks through on right and bottom edges.

**Tech Stack:** Next.js 14 App Router, TypeScript, Electron 34, Tailwind CSS, Framer Motion, Lucide React, CSS custom properties

---

### Task 1: TitleBar — taller bar + proportional sizing

Height increases from 32px to 48px. All elements scale proportionally.

**Files:**
- Modify: `src/components/layout/TitleBar.tsx`

- [ ] **Step 1: Replace `src/components/layout/TitleBar.tsx` entirely**

```tsx
'use client'
import React from 'react'
import * as ipc from '@/lib/ipc'

interface ElectronCSSProperties extends React.CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag'
}

export function TitleBar() {
  const handleMinimize = () => ipc.minimizeWindow().catch(() => {})
  const handleMaximize = () => ipc.maximizeWindow().catch(() => {})
  const handleClose = () => ipc.closeWindow().catch(() => {})

  const handleDotEnter = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.opacity = '0.65' }
  const handleDotLeave = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.opacity = '1' }

  const barStyle: ElectronCSSProperties = {
    height: 48,
    background: 'linear-gradient(90deg, #0A0418, #120820)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 16,
    flexShrink: 0,
    WebkitAppRegion: 'drag',
    userSelect: 'none',
  }

  const buttonGroupStyle: ElectronCSSProperties = {
    display: 'flex',
    gap: 8,
    WebkitAppRegion: 'no-drag',
  }

  const dotBase: React.CSSProperties = {
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'opacity 100ms',
  }

  return (
    <div style={barStyle}>
      <span style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em' }}>
        HT
      </span>
      <div style={buttonGroupStyle}>
        <button
          onClick={handleMinimize}
          aria-label="Minimize"
          style={{ ...dotBase, backgroundColor: '#3D3550' }}
          onMouseEnter={handleDotEnter}
          onMouseLeave={handleDotLeave}
        >
          <div style={{ width: 9, height: 1, backgroundColor: '#FFFFFF' }} />
        </button>
        <button
          onClick={handleMaximize}
          aria-label="Maximize"
          style={{ ...dotBase, backgroundColor: '#3D3550' }}
          onMouseEnter={handleDotEnter}
          onMouseLeave={handleDotLeave}
        >
          <div style={{ width: 9, height: 9, border: '1px solid #FFFFFF', borderRadius: 1 }} />
        </button>
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{ ...dotBase, backgroundColor: '#5A2020', color: '#F87171', fontSize: 12, lineHeight: 1 }}
          onMouseEnter={handleDotEnter}
          onMouseLeave={handleDotLeave}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 2: Layout frame — dark enclosure + corner softening

Give `<main>` a dark gradient background with 4px padding on the right and bottom, so those edges show the dark color. Add `borderTopLeftRadius: 10` to soften the harsh white corner intersection with the dark sidebar and titlebar.

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Edit `src/app/layout.tsx`**

Find:
```tsx
            <main className="flex-1 overflow-auto min-w-0">
```

Replace with:
```tsx
            <main
              className="flex-1 overflow-auto min-w-0"
              style={{
                background: 'linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%)',
                borderTopLeftRadius: 10,
                paddingRight: 4,
                paddingBottom: 4,
              }}
            >
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 3: Global styles — font bump, cell color, sidebar heading

Slightly increase base font size, darken the disabled habit cell color, and make the "Habit Tracker" heading in the sidebar larger.

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update `src/styles/globals.css`**

Change `font-size: 14px` to `font-size: 15px`:
```css
html,
body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-base);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
  height: 100vh;
}
```

Change `--cell-disabled: #EEE9FF` to `--cell-disabled: #C4B5F5`:
```css
  --cell-disabled:    #C4B5F5;
```

- [ ] **Step 2: Run font-size sweep across all tsx files**

Replace the most common inline small font size (`fontSize: 13`) with `fontSize: 14` throughout all source tsx files:

```powershell
Get-ChildItem -Path src -Recurse -Include *.tsx | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  $updated = $content -replace 'fontSize: 13\b', 'fontSize: 14'
  if ($updated -ne $content) {
    Set-Content $_.FullName $updated -NoNewline
    Write-Host "Updated: $($_.Name)"
  }
}
```

Expected: lists several files (HabitRow.tsx, HabitScoreColumn.tsx, tasks page, etc.)

- [ ] **Step 3: Update "Habit Tracker" heading size in `src/components/layout/Sidebar.tsx`**

Find:
```tsx
        <h1
          className="text-base font-semibold tracking-tight"
          style={{ color: 'var(--sidebar-text)' }}
        >
```

Replace with:
```tsx
        <h1
          className="font-semibold tracking-tight"
          style={{ color: 'var(--sidebar-text)', fontSize: 18 }}
        >
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 4: Month nav rework — arrows adjacent to month name, Today repositioned

Move both chevron arrows to sit directly beside the month heading (gap: 8px), with the ↩ Today button appearing between the month name and the next-month arrow. The Add Habit button moves to a flex:1 right-aligned container to keep the center group truly centered.

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the entire Top Bar section in `src/app/page.tsx`**

Find the entire top-bar `<div>` block that starts with:
```tsx
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
```
...and ends just before `{/* Grid area */}`.

Replace the entire top bar block (from `{/* Top Bar */}` through to the closing `</div>` before `{/* Grid area */}`) with:

```tsx
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        {/* Left spacer — balances the Add Habit button so the nav group stays centered */}
        <div style={{ flex: 1 }} />

        {/* Center: prev arrow · month heading · today button · next arrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Prev month */}
          <button
            onClick={handlePrevMonth}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              transition: 'border-color 150ms, color 150ms',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            }}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>

          {/* Month heading */}
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            {monthHeading}
          </h2>

          {/* Today pill — only when viewing a non-current month */}
          {currentMonth !== thisMonth && (
            <button
              onClick={handleGoToToday}
              aria-label="Go to current month"
              style={{
                padding: '3px 10px',
                borderRadius: 20,
                border: '1px solid var(--accent)',
                backgroundColor: 'transparent',
                color: 'var(--accent)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 150ms',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-soft)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              ↩ Today
            </button>
          )}

          {/* Next month */}
          <button
            onClick={handleNextMonth}
            disabled={isAtCurrentOrFutureMonth}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'transparent',
              color: isAtCurrentOrFutureMonth ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              opacity: isAtCurrentOrFutureMonth ? 0.4 : 1,
              cursor: isAtCurrentOrFutureMonth ? 'not-allowed' : 'pointer',
              transition: 'border-color 150ms, color 150ms',
            }}
            onMouseEnter={(e) => {
              if (!isAtCurrentOrFutureMonth) {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isAtCurrentOrFutureMonth) {
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
              }
            }}
            aria-label="Next month"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Right: Add Habit button */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setModalState({ type: 'add' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--accent)',
              backgroundColor: 'transparent',
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 500,
              transition: 'background-color 150ms',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-soft)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            }}
            aria-label="Add habit"
          >
            + Add Habit
          </button>
        </div>
      </div>
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 5: Score column — show daysInMonth denominator + relabel total row

The habit score column should show `completed/daysInMonth` (e.g. "4/31") instead of `completed/applicable`. The total row label changes to "Total Completed: X/Y" without the percentage.

**Files:**
- Modify: `src/components/habit-grid/HabitScoreColumn.tsx`
- Modify: `src/components/habit-grid/HabitRow.tsx`
- Modify: `src/components/habit-grid/HabitGrid.tsx`

- [ ] **Step 1: Update `src/components/habit-grid/HabitScoreColumn.tsx`**

Replace the entire file:

```tsx
'use client'
import React from 'react'

interface HabitScoreColumnProps {
  completed: number
  total: number
  streak: number
}

const HabitScoreColumnInner = ({ completed, total, streak }: HabitScoreColumnProps) => {
  return (
    <div
      className="tabular"
      style={{
        minWidth: 100,
        paddingLeft: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 14,
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      <span>
        {completed}/{total}
      </span>
      {streak > 0 && (
        <span
          role="text"
          aria-label={`streak: ${streak} days`}
          style={{ color: 'var(--accent)' }}
        >
          🔥{streak}
        </span>
      )}
    </div>
  )
}

export const HabitScoreColumn = React.memo(HabitScoreColumnInner)
HabitScoreColumn.displayName = 'HabitScoreColumn'
```

Note: `applicable` renamed to `total`; `total` will receive `daysInMonth` from HabitRow.

- [ ] **Step 2: Update `src/components/habit-grid/HabitRow.tsx` — pass daysInMonth as total**

Find:
```tsx
      <HabitScoreColumn
        completed={score.completed}
        applicable={score.applicable}
        streak={streak}
      />
```

Replace with:
```tsx
      <HabitScoreColumn
        completed={score.completed}
        total={daysInMonth}
        streak={streak}
      />
```

- [ ] **Step 3: Update `src/components/habit-grid/HabitGrid.tsx` — relabel total row, remove pct**

Find the `pct` calculation:
```tsx
  const pct =
    totals.applicable > 0
      ? Math.round((totals.completed / totals.applicable) * 100)
      : 0
```

Delete those 4 lines entirely.

Find the total row label string:
```tsx
                    {`Total: ${totals.completed}/${totals.applicable} habits completed (${pct}%)`}
```

Replace with:
```tsx
                    {`Total Completed: ${totals.completed}/${totals.applicable}`}
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors (pct variable removal should clear any lingering reference)

---

### Task 6: Content centering — all five pages

Each page's outermost div gets `maxWidth`, `width: '100%'`, and `margin: '0 auto'` so content stays centered and the dark `<main>` background shows on the sides on wider displays. This works in tandem with Task 2's dark `<main>` to create the enclosed framed look.

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/tasks/page.tsx`
- Modify: `src/app/projects/page.tsx`
- Modify: `src/app/goals/page.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Center habit scorecard (`src/app/page.tsx`)**

Find the outermost return div:
```tsx
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
      }}
    >
```

Replace with:
```tsx
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
        maxWidth: 1300,
        width: '100%',
        margin: '0 auto',
      }}
    >
```

- [ ] **Step 2: Center tasks page (`src/app/tasks/page.tsx`)**

Find the outermost return div:
```tsx
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
      }}
    >
```

Replace with:
```tsx
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
```

- [ ] **Step 3: Center projects page (`src/app/projects/page.tsx`)**

Find the outermost return div (line ~77):
```tsx
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
      }}
    >
```

Replace with:
```tsx
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
```

- [ ] **Step 4: Center goals page (`src/app/goals/page.tsx`)**

Find the outermost return div (line ~105):
```tsx
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
      }}
    >
```

Replace with:
```tsx
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
```

- [ ] **Step 5: Center settings page (`src/app/settings/page.tsx`)**

Find the outermost return div (line ~346):
```tsx
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
        overflowY: 'auto',
      }}
    >
```

Replace with:
```tsx
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base)',
        overflowY: 'auto',
        maxWidth: 900,
        width: '100%',
        margin: '0 auto',
      }}
    >
```

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

## Self-Review

**Spec coverage:**
- ✅ Score column shows "4/31" (completed/daysInMonth): Task 5
- ✅ Total row shows "Total Completed: X/Y": Task 5
- ✅ TitleBar thicker (48px), HT larger (16px), buttons larger (16×16): Task 1
- ✅ Right-side + bottom dark gradient frame: Task 2
- ✅ Content centralized on all pages: Task 6
- ✅ Base font bump + fontSize:13→14 sweep: Task 3
- ✅ Sidebar "Habit Tracker" larger (18px): Task 3
- ✅ Top-left corner softened (borderTopLeftRadius: 10): Task 2
- ✅ Disabled cells darkened (#C4B5F5): Task 3
- ✅ Month nav arrows adjacent (gap:8) + Today between month and next arrow: Task 4

**Placeholder scan:** No TBDs or incomplete sections. All code blocks are complete.

**Type consistency:**
- `HabitScoreColumn` prop renamed `applicable` → `total` in Task 5 Step 1; usage updated in HabitRow Step 2 — consistent.
- `pct` variable removed in HabitGrid Step 3 — no remaining references after the label string is updated.
