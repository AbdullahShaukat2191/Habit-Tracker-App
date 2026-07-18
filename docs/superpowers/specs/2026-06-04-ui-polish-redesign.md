# UI Polish & Redesign — 2026-06-04

## Overview

Seven distinct changes grouped into three categories: window/layout fixes, visual redesign, and UX improvements. All changes are scoped to the renderer and Electron main process — no database or IPC data layer changes.

---

## 1. Window Controls & Titlebar

### Problem
`frame: true` + `titleBarStyle: 'hidden'` on Windows hides the native titlebar but shows no window controls and provides no drag region. The window cannot be moved and has no minimize/maximize buttons.

### Design
- Change `electron/main.ts` to `frame: false` (removes native OS chrome entirely; resize via edges still works by default on Windows)
- Add three new IPC channels: `window:minimize`, `window:maximize`, `window:close` — handled in `electron/ipc/handlers.ts` using `BrowserWindow.getFocusedWindow()`
- Expose on `window.electronAPI`: `minimizeWindow()`, `maximizeWindow()`, `closeWindow()`
- New component: `src/components/layout/TitleBar.tsx`
  - 32px tall, full window width, spans above both sidebar and content
  - Background: `linear-gradient(90deg, #0A0418, #120820)` (dark, matches sidebar top)
  - `-webkit-app-region: drag` on the bar itself; `-webkit-app-region: no-drag` on buttons
  - Left: "HT" in white, 11px, font-weight 700, tracking 0.1em, 16px left padding
  - Right: three dot buttons (12px diameter circles), 12px right padding, 6px gap
    - Minimize: `#3D3550` background, 7×1px white bar icon
    - Maximize: `#3D3550` background, 7×7px white square outline icon
    - Close: `#5A2020` background, `#F87171` × icon
  - Buttons: hover opacity 0.75, transition 100ms, cursor pointer
- `src/app/layout.tsx`: Wrap current flex row in a column; TitleBar sits above the sidebar+main row

### Layout after change
```
<body>
  <div flex-col h-screen>
    <TitleBar />                     ← new, 32px
    <div flex flex-1 overflow-hidden>
      <Sidebar />
      <main flex-1 overflow-auto min-w-0>
        {children}
      </main>
    </div>
  </div>
</body>
```

Note: `min-w-0` on `<main>` is critical — fixes the layout reflow bug where content doesn't scroll horizontally when the window is resized narrow (flex items default to `min-width: auto` which prevents shrinking).

---

## 2. Color Palette — Obsidian Violet

### Design
Sidebar/nav: deep dark purple gradient. Content areas (all pages): light mode, white/near-white with lavender tints. Accent: violet replaces pink everywhere.

### New CSS tokens (`src/styles/globals.css`)

```css
:root {
  /* Content backgrounds (light) */
  --bg-base:          #F8F7FF;   /* main content area — very subtle lavender white */
  --bg-surface:       #FFFFFF;   /* cards, modals */
  --bg-surface-2:     #F0EEFF;   /* hover states, secondary panels */
  --bg-input:         #F5F3FF;   /* input fields */

  /* Sidebar backgrounds (dark) */
  --sidebar-from:     #0A0418;
  --sidebar-to:       #1A0A35;
  --titlebar-from:    #0A0418;
  --titlebar-to:      #120820;

  /* Borders */
  --border-subtle:    #EDE9FE;
  --border-strong:    #DDD6FE;

  /* Accent — violet */
  --accent:           #6D28D9;
  --accent-end:       #7C3AED;   /* gradient end */
  --accent-soft:      #EDE9FE;
  --accent-glow:      rgba(124, 58, 237, 0.15);

  /* Text — content area */
  --text-primary:     #1A0A35;
  --text-secondary:   #5B4F7A;
  --text-tertiary:    #9B8BBF;
  --text-success:     #059669;

  /* Text — sidebar */
  --sidebar-text:         #FFFFFF;
  --sidebar-text-muted:   #8B7BB5;

  /* Habit cells */
  --cell-filled-from: #5B21B6;
  --cell-filled-to:   #7C3AED;
  --cell-empty:       #F5F3FF;
  --cell-disabled:    #EEE9FF;
}
```

### Where `--accent-pink` is referenced
All existing references to `--accent-pink`, `--accent-pink-soft`, `--accent-pink-glow` must be replaced with `--accent`, `--accent-soft`, `--accent-glow` respectively. Affects:
- `globals.css` scrollbar thumb hover, focus ring
- `Sidebar.tsx` active indicator border and accent underline
- `HabitCell.tsx` box-shadow glow and pulse animation colors
- `HabitModal.tsx`, `AddTaskModal.tsx`, `ProjectModal.tsx`, `GoalModal.tsx` — button borders/colors
- All page-level `+ Add X` buttons (Tasks, Projects, Goals, Habits)
- `MonthlyReportCard.tsx` tier badge

The habit cell filled state uses a CSS gradient via the `style` prop:
```tsx
background: `linear-gradient(135deg, var(--cell-filled-from), var(--cell-filled-to))`
```
CSS custom properties work fine in `style` prop `background`. However, Framer Motion's `animate` prop requires literal color values (it interpolates between them). The existing pulse animation `backgroundColor: ['#FF9DDE', '#E879B9']` must be updated to violet equivalents: `backgroundColor: ['#9B6FD4', '#7C3AED']`.

### Sidebar background
Change `Sidebar.tsx` aside background from `var(--bg-surface)` to:
```tsx
background: `linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%)`
```
Active nav item background changes from `var(--bg-surface-2)` to `rgba(109, 40, 217, 0.25)` with left border `var(--accent)`. Text colors reference `--sidebar-text` and `--sidebar-text-muted` rather than `--text-primary`/`--text-secondary`.

---

## 3. Habit Cells — Rounded Squares

### Design
Replace circles with squares with 4px border-radius (similar to a Google Sheets habit tracker).

In `src/components/habit-grid/HabitCell.tsx`:
- `borderRadius: '50%'` → `borderRadius: 4`
- Size: keep 20×20px
- The `motion.div` animate pulse scale: `[1, 1.3, 1]` (slightly less dramatic for square vs circle)
- Filled cell: `background: linear-gradient(135deg, var(--cell-filled-from), var(--cell-filled-to))`
- Empty cell: `background: var(--cell-empty)`, `border: 1.5px solid var(--border-strong)`
- Disabled cell: `background: var(--cell-disabled)`, no border

---

## 4. "Move to Current Month" Button

### Design
In `src/app/page.tsx`, add a "Today" pill button in the month navigation row. It only renders when `currentMonth !== thisMonth`.

- Positioned inline after the `‹ Prev` / month label / `Next ›` controls
- Label: `↩ Today`
- Style: small ghost button — violet border, violet text, transparent bg, hover fills with `--accent-soft`
- On click: set `slideDirection` to `'left'` if `currentMonth < thisMonth`, `'right'` if `currentMonth > thisMonth` (shouldn't happen but defensive), then `setCurrentMonth(thisMonth)`

---

## 5. Delete UX — Habits & Goals

### Current state
- **Habits**: Delete lives inside the Edit modal as an inline confirmation (text toggles to "Are you sure?"). Exists but easily missed.
- **Goals**: Delete is an inline confirmation within GoalCard. Also easily missed.

### Design
No structural change to the confirmation flow (it's good). Make the trigger more visible:

**Habits (HabitModal.tsx in edit mode)**:
- Currently the delete button is a small text link. Change to a proper `Trash2` icon button with `color: #EF4444` (red), visible at all times (not just on hover) in the modal footer.

**Goals (GoalCard.tsx)**:
- The delete icon button currently requires hovering over the card. Keep hover reveal but increase the hit target: 32×32px, and show it on card focus too (`:focus-within`). This makes it keyboard-accessible and more discoverable.

---

## 6. Layout / Resize Fix (already covered in §1)

The `min-w-0` fix on `<main>` in layout.tsx is the only change needed. This allows the flex child to shrink below its natural content width, enabling the inner `overflow-auto` to create a horizontal scrollbar rather than clipping content off-screen.

---

## Files Changed

| File | Change |
|---|---|
| `electron/main.ts` | `frame: false` |
| `electron/ipc/handlers.ts` | Add `window:minimize`, `window:maximize`, `window:close` handlers |
| `electron/preload.ts` | Add `minimizeWindow`, `maximizeWindow`, `closeWindow` |
| `src/types/electron.d.ts` | Add three new method signatures |
| `src/lib/ipc.ts` | Add three wrapper exports |
| `src/styles/globals.css` | Full token replacement |
| `src/app/layout.tsx` | Add TitleBar, add `min-w-0` to main |
| `src/components/layout/TitleBar.tsx` | New file |
| `src/components/layout/Sidebar.tsx` | Gradient bg, violet active states, sidebar text colors |
| `src/app/page.tsx` | Add `↩ Today` button |
| `src/components/habit-grid/HabitCell.tsx` | Rounded squares, new colors |
| `src/components/habit-grid/HabitModal.tsx` | More visible delete button |
| `src/components/goals/GoalCard.tsx` | Larger delete hit target, focus-visible show |
| All modal + button components | `--accent-pink` → `--accent` token swap |

Total: ~15 files. No new IPC data channels, no database changes.
