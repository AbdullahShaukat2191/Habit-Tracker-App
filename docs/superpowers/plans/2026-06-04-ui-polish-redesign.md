# UI Polish & Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix window controls/dragging, replace the pink palette with Obsidian Violet (dark purple nav + light content), change habit cells to rounded squares, add "↩ Today" month shortcut, and improve delete discoverability.

**Architecture:** All changes are renderer + Electron main process only — no data layer or IPC data channels touched. Color changes flow through CSS custom property tokens in globals.css; all components reference tokens, so the global swap propagates automatically after a find-replace of token names.

**Tech Stack:** Next.js 14 App Router, TypeScript, Electron 34, Tailwind CSS, Framer Motion, Lucide React, CSS custom properties

---

### Task 1: Window controls IPC layer

Wire up `window:minimize`, `window:maximize`, `window:close` IPC channels so the TitleBar component (Task 2) can call them.

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/ipc/handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `src/types/electron.d.ts`
- Modify: `src/lib/ipc.ts`

- [ ] **Step 1: Change `electron/main.ts` — remove titleBarStyle, set frame: false**

In the `createWindow()` function, replace:
```typescript
    titleBarStyle: 'hidden',
    // Show frame on Windows for resize handles; can refine to overlay later
    frame: true,
```
with:
```typescript
    frame: false,
```

- [ ] **Step 2: Add three IPC handlers to `electron/ipc/handlers.ts`**

After the existing `handle('app:quit', ...)` line, add:
```typescript
  // Window controls
  handle('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
  handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  handle('window:close', () => BrowserWindow.getFocusedWindow()?.close())
```

- [ ] **Step 3: Expose three methods in `electron/preload.ts`**

After `testNotification: () => ipcRenderer.invoke('notifications:test'),` add:
```typescript
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
```

- [ ] **Step 4: Add type signatures to `src/types/electron.d.ts`**

After `testNotification: () => Promise<void>` add:
```typescript
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
```

- [ ] **Step 5: Add wrapper exports to `src/lib/ipc.ts`**

After `export const testNotification = ...` add:
```typescript
export const minimizeWindow = (): Promise<void> => api().minimizeWindow()
export const maximizeWindow = (): Promise<void> => api().maximizeWindow()
export const closeWindow = (): Promise<void> => api().closeWindow()
```

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 2: TitleBar component + layout restructure

Create the TitleBar component and restructure layout.tsx to place it at the top. Also fixes the horizontal resize bug via `min-w-0`.

**Files:**
- Create: `src/components/layout/TitleBar.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/components/layout/TitleBar.tsx`**

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

  const barStyle: ElectronCSSProperties = {
    height: 32,
    background: 'linear-gradient(90deg, #0A0418, #120820)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 12,
    flexShrink: 0,
    WebkitAppRegion: 'drag',
    userSelect: 'none',
  }

  const buttonGroupStyle: ElectronCSSProperties = {
    display: 'flex',
    gap: 6,
    WebkitAppRegion: 'no-drag',
  }

  const dotBase: React.CSSProperties = {
    width: 12,
    height: 12,
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
      <span style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>
        HT
      </span>
      <div style={buttonGroupStyle}>
        <button
          onClick={handleMinimize}
          aria-label="Minimize"
          style={{ ...dotBase, backgroundColor: '#3D3550' }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.65' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          <div style={{ width: 7, height: 1, backgroundColor: '#FFFFFF' }} />
        </button>
        <button
          onClick={handleMaximize}
          aria-label="Maximize"
          style={{ ...dotBase, backgroundColor: '#3D3550' }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.65' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          <div style={{ width: 7, height: 7, border: '1px solid #FFFFFF', borderRadius: 1 }} />
        </button>
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{ ...dotBase, backgroundColor: '#5A2020', color: '#F87171', fontSize: 9, lineHeight: 1 }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.65' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import '../styles/globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { TitleBar } from '@/components/layout/TitleBar'
import { Toast } from '@/components/ui/Toast'
import { GlobalShortcuts } from '@/components/layout/GlobalShortcuts'

export const metadata: Metadata = {
  title: 'Habit Tracker',
  description: 'Your discipline command center',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col h-screen overflow-hidden">
          <TitleBar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto min-w-0">
              {children}
            </main>
          </div>
        </div>
        <Toast />
        <GlobalShortcuts />
      </body>
    </html>
  )
}
```

Note: `min-w-0` on `<main>` fixes the horizontal resize bug — flex items default to `min-width: auto`, which prevented the main area from shrinking and enabling horizontal scroll.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 3: Color palette — replace all CSS tokens

Replace `src/styles/globals.css` with Obsidian Violet tokens, then sweep all 18 files replacing the old `--accent-pink*` token names with the new `--accent*` names.

**Files:**
- Modify: `src/styles/globals.css`
- Modify (token rename sweep): `src/app/page.tsx`, `src/app/tasks/page.tsx`, `src/app/projects/page.tsx`, `src/app/goals/page.tsx`, `src/app/settings/page.tsx`, `src/components/habit-grid/HabitModal.tsx`, `src/components/habit-grid/HabitCell.tsx`, `src/components/habit-grid/HabitRow.tsx`, `src/components/habit-grid/HabitScoreColumn.tsx`, `src/components/habit-grid/HabitGridHeader.tsx`, `src/components/habit-grid/MonthlyReportCard.tsx`, `src/components/goals/GoalModal.tsx`, `src/components/goals/GoalCard.tsx`, `src/components/projects/ProjectModal.tsx`, `src/components/tasks/AddTaskModal.tsx`, `src/components/tasks/TaskCard.tsx`, `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Replace `src/styles/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  /* Content backgrounds (light) */
  --bg-base:          #F8F7FF;
  --bg-surface:       #FFFFFF;
  --bg-surface-2:     #F0EEFF;
  --bg-input:         #F5F3FF;

  /* Sidebar/titlebar (dark) */
  --sidebar-from:     #0A0418;
  --sidebar-to:       #1A0A35;

  /* Borders */
  --border-subtle:    #EDE9FE;
  --border-strong:    #DDD6FE;

  /* Accent — violet */
  --accent:           #6D28D9;
  --accent-end:       #7C3AED;
  --accent-soft:      #EDE9FE;
  --accent-glow:      rgba(124, 58, 237, 0.15);

  /* Text — content area */
  --text-primary:     #1A0A35;
  --text-secondary:   #5B4F7A;
  --text-tertiary:    #9B8BBF;
  --text-success:     #059669;

  /* Text — sidebar */
  --sidebar-text:       #FFFFFF;
  --sidebar-text-muted: #8B7BB5;

  /* Habit cells */
  --cell-filled-from: #5B21B6;
  --cell-filled-to:   #7C3AED;
  --cell-empty:       #F5F3FF;
  --cell-disabled:    #EEE9FF;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-base);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
  height: 100vh;
}

#__next,
html,
body {
  height: 100%;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: var(--bg-surface-2);
}
::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

button {
  cursor: pointer;
  font-family: inherit;
}

.drag-handle {
  cursor: grab;
}
.drag-handle:active {
  cursor: grabbing;
}
```

- [ ] **Step 2: Rename tokens across all affected files**

Run these three find-replace operations across the entire `src/` directory:

1. Replace `var(--accent-pink-soft)` → `var(--accent-soft)` (all files)
2. Replace `var(--accent-pink-glow)` → `var(--accent-glow)` (all files)
3. Replace `var(--accent-pink)` → `var(--accent)` (all files — do this LAST so it doesn't partially match the above)

Using PowerShell (run from project root):
```powershell
Get-ChildItem -Path src -Recurse -Include *.tsx,*.ts,*.css | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  $updated = $content `
    -replace 'var\(--accent-pink-soft\)', 'var(--accent-soft)' `
    -replace 'var\(--accent-pink-glow\)', 'var(--accent-glow)' `
    -replace 'var\(--accent-pink\)', 'var(--accent)'
  if ($updated -ne $content) {
    Set-Content $_.FullName $updated -NoNewline
    Write-Host "Updated: $($_.Name)"
  }
}
```

Expected output: lists ~17 files updated.

- [ ] **Step 3: Verify no --accent-pink references remain**

Run: `grep -r "accent-pink" src/`
Expected: no output (zero matches)

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 4: Sidebar redesign

Apply the dark gradient background and sidebar-specific text colors to the Sidebar component.

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Replace `src/components/layout/Sidebar.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, CheckSquare, FolderOpen, Target, Settings } from 'lucide-react'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { href: '/',           icon: LayoutGrid,  label: 'Habit Scorecard' },
  { href: '/tasks',      icon: CheckSquare, label: 'Current Tasks' },
  { href: '/projects',   icon: FolderOpen,  label: 'Projects' },
  { href: '/goals',      icon: Target,      label: 'Long-Term Goals' },
]

export function Sidebar() {
  const rawPathname = usePathname()
  const pathname = rawPathname === '/' ? '/' : rawPathname.replace(/\/$/, '')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    setDateStr(format(new Date(), 'EEEE, MMMM d'))
  }, [])

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: 240,
        background: 'linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* App header */}
      <div className="px-6 pt-5 pb-4">
        <h1
          className="text-base font-semibold tracking-tight"
          style={{ color: 'var(--sidebar-text)' }}
        >
          Habit Tracker
          <span
            className="block mt-1 h-0.5 rounded-full w-8"
            style={{ background: 'var(--accent)' }}
          />
        </h1>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative"
              style={{
                color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)',
                backgroundColor: isActive ? 'rgba(109, 40, 217, 0.25)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                paddingLeft: isActive ? '10px' : '12px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(109, 40, 217, 0.15)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-muted)'
                }
              }}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Settings + date footer */}
      <div className="px-3 pb-5 flex flex-col gap-0.5">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative"
          style={{
            color: pathname === '/settings' ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)',
            backgroundColor: pathname === '/settings' ? 'rgba(109, 40, 217, 0.25)' : 'transparent',
            borderLeft: pathname === '/settings' ? '2px solid var(--accent)' : '2px solid transparent',
            paddingLeft: pathname === '/settings' ? '10px' : '12px',
          }}
          onMouseEnter={(e) => {
            if (pathname !== '/settings') {
              ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(109, 40, 217, 0.15)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)'
            }
          }}
          onMouseLeave={(e) => {
            if (pathname !== '/settings') {
              ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-muted)'
            }
          }}
        >
          <Settings size={16} strokeWidth={1.8} />
          <span>Settings</span>
        </Link>

        {dateStr && (
          <p
            className="px-3 pt-3 text-xs"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            {dateStr}
          </p>
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 5: Habit cells — rounded squares + violet gradient

Change the circular habit cells to rounded squares with a violet gradient fill.

**Files:**
- Modify: `src/components/habit-grid/HabitCell.tsx`

- [ ] **Step 1: Replace the inner `motion.div` and its surrounding div in `HabitCell.tsx`**

Replace the entire return statement's inner motion.div (lines ~69–94) with:

```tsx
      <motion.div
        animate={
          pulsing
            ? {
                scale: [1, 1.3, 1],
                ...(wasEmptyRef.current
                  ? { backgroundColor: ['#9B6FD4', '#7C3AED'] }
                  : {}),
              }
            : {}
        }
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: state === 'filled'
            ? 'linear-gradient(135deg, var(--cell-filled-from), var(--cell-filled-to))'
            : state === 'disabled'
            ? 'var(--cell-disabled)'
            : 'var(--cell-empty)',
          border: state === 'empty' ? '1.5px solid var(--border-strong)' : 'none',
          boxShadow:
            pulsing
              ? '0 0 0 4px var(--accent-glow), 0 0 0 2px var(--accent-soft)'
              : state === 'filled' && isToday
              ? '0 0 8px var(--accent-glow)'
              : 'none',
        }}
      />
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 6: "↩ Today" button in habit scorecard

Add a pill button that appears when the user is viewing a past month, returning them to the current month.

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add `handleGoToToday` callback in `HabitScorecardPage`**

After `handleNextMonth` useCallback, add:
```tsx
  const handleGoToToday = useCallback(() => {
    setSlideDirection(currentMonth < thisMonth ? 'left' : 'right')
    setCurrentMonth(thisMonth)
  }, [currentMonth, thisMonth, setCurrentMonth])
```

- [ ] **Step 2: Replace the center heading section in the Top Bar**

Find this JSX block (the center h2 + the Next button):
```tsx
        {/* Center: heading (flex: 1 so it fills space and stays centered) */}
        <h2
          style={{
            flex: 1,
            margin: 0,
            textAlign: 'center',
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          {monthHeading}
        </h2>
```

Replace with:
```tsx
        {/* Center: heading + optional Today button */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {monthHeading}
          </h2>
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
        </div>
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 7: Delete UX improvements

Make delete actions more discoverable in the Habit modal and on Goal cards.

**Files:**
- Modify: `src/components/habit-grid/HabitModal.tsx`
- Modify: `src/components/goals/GoalCard.tsx`

- [ ] **Step 1: Add `Trash2` import to `HabitModal.tsx`**

Replace:
```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
```
with:
```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
```

- [ ] **Step 2: Replace the delete trigger button in `HabitModal.tsx`**

Find and replace the `!showDeleteConfirm` branch (the muted "Delete habit" text link):
```tsx
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: 13,
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    transition: 'color 150ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#f87171'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-tertiary)'
                  }}
                >
                  Delete habit
                </button>
```
with:
```tsx
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label="Delete habit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    fontSize: 13,
                    color: '#EF4444',
                    cursor: 'pointer',
                    transition: 'opacity 150ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                >
                  <Trash2 size={14} />
                  Delete habit
                </button>
```

- [ ] **Step 3: Add `Trash2` import to `GoalCard.tsx`**

Replace:
```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Goal } from '@shared/types'
import { goalConfetti } from '@/lib/confetti'
```
with:
```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import type { Goal } from '@shared/types'
import { goalConfetti } from '@/lib/confetti'
```

- [ ] **Step 4: Update `handleDeleteClick` in `GoalCard.tsx` to force-expand the card**

Replace:
```tsx
  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }, [])
```
with:
```tsx
  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(true)
    setShowDeleteConfirm(true)
  }, [])
```

- [ ] **Step 5: Add hover-reveal Trash2 button to the GoalCard's main row**

In the GoalCard return, find the closing `</div>` of the content div (after the AnimatePresence block) — it's the last thing before the outer card div's closing tag. Add a sibling Trash2 button after the content div:

```tsx
      {/* Hover-reveal delete button */}
      {isHovered && !isCompleted && (
        <button
          onClick={handleDeleteClick}
          aria-label={`Delete "${goal.title}"`}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            color: '#F87171',
            cursor: 'pointer',
            flexShrink: 0,
            borderRadius: 6,
            transition: 'color 150ms, background-color 150ms',
            alignSelf: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#EF4444'
            e.currentTarget.style.backgroundColor = '#FEF2F2'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#F87171'
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <Trash2 size={14} />
        </button>
      )}
```

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

## Self-Review

**Spec coverage:**
- ✅ §1 Window controls: Tasks 1–2
- ✅ §2 Color palette: Tasks 3–4
- ✅ §3 Habit cell squares: Task 5
- ✅ §4 "↩ Today" button: Task 6
- ✅ §5 Delete UX: Task 7
- ✅ §6 Layout fix `min-w-0`: Task 2, Step 2

**Placeholder scan:** No TBDs, TODOs, or "similar to above" patterns. All code is complete.

**Type consistency:**
- `minimizeWindow`, `maximizeWindow`, `closeWindow` declared in electron.d.ts (Task 1 Step 4), exposed in preload.ts (Step 3), exported from ipc.ts (Step 5) — names match throughout.
- `ElectronCSSProperties` interface defined and used in TitleBar.tsx only.
- `handleGoToToday` defined in Step 1, used in Step 2 — names match.
- Token names `--accent`, `--accent-soft`, `--accent-glow` defined in globals.css (Task 3 Step 1), used throughout after sweep (Step 2).
