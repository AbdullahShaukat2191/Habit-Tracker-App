# Habit Tracker — Master Build Specification

## Mission

Build a desktop **Habit Tracker** application — a single-user productivity command center that combines a James Clear-style habit scorecard, a stripped-down task manager, and a long-term goals tracker. The user is a CS student running multiple client projects, an AI automation business, university coursework, gym, and a structured spiritual practice. Pen-and-paper systems can't keep up with the load. This app is the digital command center.

**Design philosophy:** James Clear's Atomic Habits framework (visual cues, streaks, "never miss twice," immediate dopamine reward for progress) fused with Alex Hormozi's clarity principle — *"cut through the noise and focus on what needs to be done."* Nothing flashy. Nothing decorative. Every pixel must earn its place.

This is **not** a generic todo app. Every design and engineering decision must serve three goals: clarity, focus, and the dopamine loop of visible progress.

---

## Hard Rules Before You Code

This is a multi-feature application with non-trivial complexity (desktop wrapper, native notifications, IPC, database, AI integration, animations, system tray). **Do not start coding immediately.**

1. Read this entire specification end-to-end first.
2. Plan architecture comprehensively: file structure, component tree, state management, database schema, IPC flow between Next.js and Electron, notification daemon, build pipeline.
3. Write a phased implementation plan (Phase 1: foundation, Phase 2: habit tracker, Phase 3: tasks/goals/projects, Phase 4: notifications + monthly report, Phase 5: polish/animations/onboarding).
4. Present the plan to me for approval.
5. Only after approval, begin Phase 1.
6. After each phase, checkpoint with me before continuing.

Use every planning capability available to you. Skipping the planning phase is the single biggest failure mode here.

---

## Tech Stack (Locked)

- **Framework:** Next.js 14+ (App Router) + TypeScript
- **Desktop wrapper:** Electron (Next.js as renderer, Electron main process for OS integration)
- **Database:** SQLite via `better-sqlite3` (synchronous, fast, perfect for single-user local-first)
- **ORM/Query:** Drizzle ORM (typed, lightweight, no migrations bloat)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Global state:** Zustand
- **Drag & drop:** `@dnd-kit/core` + `@dnd-kit/sortable`
- **Confetti:** `canvas-confetti`
- **Date utilities:** `date-fns`
- **Auto-launch on startup:** `auto-launch`
- **AI insights:** `@anthropic-ai/sdk` (for monthly report generation)
- **Icons:** `lucide-react`

For the Next.js + Electron bridge: use a clean IPC layer with typed channels. Set up the Next.js dev server to be consumed by Electron in dev, and use `next export` (static export) wrapped by Electron for production build.

---

## Visual Design System

### Color Tokens

```
/* Backgrounds */
--bg-base:        #150B1F  /* deepest layer, app background */
--bg-surface:     #1F1230  /* cards, sidebar, modals */
--bg-surface-2:   #2A1838  /* elevated surfaces, hover states */
--bg-input:       #2D1A3D  /* form inputs */

/* Borders */
--border-subtle:  #3A2348  /* card borders, dividers */
--border-strong:  #4F3060  /* focused inputs, active elements */

/* Accents */
--accent-pink:    #E879B9  /* primary accent - use SPARINGLY for emphasis */
--accent-pink-soft: #E879B922  /* tints, glows, soft fills */
--accent-pink-glow: #E879B940  /* hover glows, completion flashes */

/* Text */
--text-primary:   #FFFFFF  /* main copy */
--text-secondary: #B8A8C8  /* labels, metadata, secondary copy */
--text-tertiary:  #7A6A88  /* placeholders, disabled, grayed cells */
--text-success:   #A7F3D0  /* streak/completion green-mint, used sparingly */

/* Functional */
--cell-filled:    #E879B9  /* completed habit cell */
--cell-empty:     #2A1838  /* unfilled habit cell */
--cell-disabled:  #1F1230  /* days habit doesn't apply (e.g. gym Sundays) */
--cell-today:     #4F3060  /* today's column highlight */
```

### Typography

- **Font:** Inter (variable font, weights 400/500/600/700)
- Headings: 600 weight, tight tracking
- Body: 400 weight, comfortable line-height (1.5)
- Numbers/stats: tabular-nums for clean column alignment
- No more than 3 text sizes per screen

### Spacing & Layout

- Use Tailwind's spacing scale, default to multiples of 4
- Sidebar: 240px fixed width on desktop
- Content area: comfortable padding (32px), max content width ~1400px
- Cards: 16px padding minimum, 12px border-radius
- Hierarchy comes from spacing and color, NOT from size jumps

### Animation Principles

- Default duration: 200ms, ease-out
- Sliding month transitions: 350ms, cubic-bezier(0.4, 0, 0.2, 1)
- Task strikethrough: 200ms left-to-right (the exact speed of crossing off a line with a pen)
- Hover states: subtle scale (1.02) or opacity shift, never bouncy
- Confetti: small burst, ~80 particles, 1.5s duration, pink/white/purple palette
- No spinning, no bouncing, no parallax — Hormozi clarity

---

## App Architecture

### Sidebar Navigation (Left, Fixed, 240px)

Top to bottom:
1. **Habit Scorecard** (default landing page)
2. **Current Tasks**
3. **Projects**
4. **Long-Term Goals**
5. (spacer / push to bottom)
6. **Settings**

Each item: icon (lucide-react) + label. Active item gets a soft pink left-border indicator + slightly elevated background. No nested menus, no collapsing — flat and obvious.

Above the nav items, a minimal app header: "Habit Tracker" wordmark in Inter 600, faint pink underline accent. No logo image, no decoration.

Below the nav items at the bottom: today's date in a small, dim format (e.g., "Wednesday, June 3").

---

## Section 1: Habit Scorecard

### Top Bar

- **Left:** Left arrow button (lucide `ChevronLeft`)
- **Center:** Current month name + year, large heading ("June 2026")
- **Right:** Right arrow button (lucide `ChevronRight`)
- **Far right:** "+ Add Habit" button (pink-bordered, ghost style)

Clicking left/right arrows slides the entire grid horizontally with a 350ms ease-out animation (Framer Motion `motion.div` + `AnimatePresence`). Right arrow disabled if current month is being viewed (no future months).

### The Grid

A spreadsheet-style grid mimicking James Clear's habit journal:

```
                | 1  2  3  4  5  6  7  8 ... 30 | Score
----------------|--------------------------------|--------
Pray Fajr       | ●  ●  ○  ●  ●  ●  ●  ●        | 24/30 🔥7
Gym             | ●  ●  ●  ●  ●  ▓  ●  ●        | 20/26 🔥3
Drink 3L Water  | ●  ●  ●  ●  ●  ●  ●  ●        | 28/30 🔥12
Skincare        | ○  ●  ●  ●  ●  ●  ●  ●        | 22/30 🔥5
----------------|--------------------------------|--------
                                          Total: 94/116 (81%)
```

**Cell states:**
- `●` Filled (pink, `--cell-filled`) — habit completed that day
- `○` Empty (`--cell-empty`) — habit not yet done
- `▓` Disabled (`--cell-disabled`, grayed out, not clickable) — day this habit doesn't apply
- Today's column has a subtle border highlight (`--cell-today`)

**Click behavior:**
- Click an empty cell for **today** → marks complete with brief pink flash animation + tiny confetti burst (10–15 particles) from the cell
- Click a filled cell for today → marks incomplete (undo)
- **Cells for past days are read-only.** No backfilling, ever. (User stays honest.)
- Clicking a past cell does nothing visible; optionally a brief tooltip "Past days are locked — keep yourself honest."

**Row interactions:**
- Drag handle on the left edge of each row (only visible on hover) to reorder habits
- Click habit name → opens edit modal (rename, change schedule, delete)
- Long-press or "..." menu on hover → quick delete

**Per-habit score (right column):**
- Format: `completed / applicable_days` (e.g., 24/30 for daily habits, 20/26 for gym on a month where 4 Sundays are excluded)
- Streak counter next to it: `🔥7` (current streak, days, not counting today if today isn't marked yet — only past completed days)
- Streak respects the schedule: skipping a non-applicable day does NOT break the streak

**Bottom row — Monthly Total:**
- A non-clickable summary row showing aggregate completion: `Total: 94/116 habits completed (81%)`
- Updates live as cells are toggled
- The denominator accounts for each habit's schedule (gym only counts its 6 applicable days per week, etc.)

### Add Habit Modal

Opens centered, dimmed backdrop, smooth fade-in (200ms).

Fields:
- **Habit name** (required, text input)
- **Schedule** — pill selector for days of week (Mon Tue Wed Thu Fri Sat Sun), all selected by default. User can deselect (e.g., deselect Sun for "Gym"). Pills turn pink when selected, gray when not.
- **Save / Cancel** buttons (Save is pink, primary)

Edit habit modal: same as add, with current values pre-filled, plus a "Delete habit" destructive option at the bottom (requires confirmation).

### "Never Miss Twice" Nudge

If yesterday wasn't marked complete for a habit (and yesterday was an applicable day), display a subtle pink dot or small "!" indicator next to the habit name today. Tooltip on hover: *"Don't miss twice — get this one today."* No pop-ups, no badges, no shaming. Quiet but present.

### Monthly Summary Card

When viewing a month that has fully ended (i.e., not the current month, and at least one full month of data exists), a card appears below the grid:

> **June 2026 Monthly Report** ✨
> 
> [Badge tier visual]
> 
> [AI-generated narrative summary, ~3-4 sentences, generated via Claude API]
> 
> [Stats grid: overall %, best habit, worst habit, longest streak, total tasks completed, project breakdown]
> 
> [Comparison to previous month, if exists]

If the current month is being viewed and a report exists for a *past* month, no card shows here — only on the past month's view. When you navigate to a month with a report, the card slides in below the grid.

When a new month's report is generated (auto on the 1st of the following month), show a small in-app toast notification at the top: *"Your Monthly Summary for June is ready. Click to view."* Clicking jumps to that month's view.

**Badge tier system (based on overall completion %):**

| Range | Tier | Badge Name | Description seed |
|---|---|---|---|
| 0–20% | I | "Reset" | Hardest month is the next one — show up tomorrow. |
| 21–40% | II | "Stirring" | Something's moving. Stack the next week. |
| 41–60% | III | "Building" | You're past the easy quitter zone. |
| 61–80% | IV | "Climbing" | Most people don't get here. Keep pressing. |
| 81–95% | V | "Crushing" | This is the operator zone. Don't ease off. |
| 96–100% | VI | "Untouchable" | Top 1% behavior. Now make it boring. |

Badges are visual — a minimal geometric mark (no medals, no clip-art). Think a small pink-accented sigil on a dark card. The badge name + description seed is shown, and the AI-generated narrative builds from there.

---

## Section 2: Current Tasks

### Header

- **Top:** Today's date in large heading ("Wednesday, June 3, 2026")
- **Below:** Tab toggle — "Today" / "Completed"
- **Far right:** "+ Add Task" button

### Today View

A vertical list of task cards. Each card:

```
┌─────────────────────────────────────────────┐
│ ☐  Finish Torgy.ai Tally form integration   │
│    [Torgy.ai · pink dot]                    │
│    Optional description shown muted below   │
└─────────────────────────────────────────────┘
```

- **Checkbox on the left** — large, clickable, single-click toggle (NO dropdown, NO status menu)
- **Task title** — main text
- **Project tag (if assigned)** — small chip showing project name + a small dot in the project's color
- **Description (if added)** — shown muted below the title, two lines max, click card to expand

**Clicking the checkbox:**
1. Strikethrough animates left-to-right across the title in 200ms (CSS `clip-path` or pseudo-element)
2. Small confetti burst (~30 particles) shoots from both sides of the screen
3. Card stays visible with strikethrough for the rest of today
4. On the next calendar day (next app launch after midnight), it auto-moves to "Completed" view

**Completed View:**
- Shows historical completed tasks sorted by completion date (newest first)
- Grouped by date with section headers ("Yesterday — Tue Jun 2", "Mon Jun 1", etc.)
- Same card style, with strikethrough preserved
- No "uncomplete" action here — completed is final

**Persistent tasks:**
- Tasks not marked complete persist indefinitely in the Today view
- They do NOT auto-roll-over — they were added on some day, they sit there until done or deleted

**Card interactions:**
- Click card body → expands to show full description, edit button, delete button
- Hover → subtle background lighten + delete icon appears in top-right

### Add Task Modal

- **Task title** (required, text input, auto-focused)
- **Description** (optional, textarea, expandable)
- **Project** (optional, dropdown of existing projects + "None")
- **Save / Cancel**

Keyboard shortcut: `Ctrl+N` opens this modal from anywhere in the app.

### Empty State

If there are zero tasks in Today view, show a center-screen card:

> **[Hormozi/Goggins quote, randomly selected]**
> 
> — Alex Hormozi / David Goggins

Below the quote, a subtle "Add your first task" button. No clutter.

### All Tasks Completed State

When all tasks in Today view are marked done (and there's at least 1 task), trigger:
1. Large center-screen modal/dialog (auto-dismissable, click anywhere to close)
2. Full-screen confetti burst (~150 particles, 2s duration, from both sides converging)
3. Random Goggins or Hormozi quote in the dialog, large readable type
4. Subtitle: "All tasks done. Tomorrow you do it again."

This is the dopamine payoff. Make it feel earned.

---

## Section 3: Projects

A dedicated section in the sidebar.

### Header

- Page title: "Projects"
- "+ Add Project" button (top right)

### Project List

Each project displayed as a card:

```
┌──────────────────────────────────────────┐
│ ● Torgy.ai                               │
│ 12 active tasks · 47 completed           │
│ [Edit] [Delete]                          │
└──────────────────────────────────────────┘
```

- **Color dot** matches project's assigned color
- **Project name**
- **Quick stats**: active task count + completed task count
- **Edit** opens modal to rename or change color
- **Delete** — requires confirmation; if tasks are assigned, they become "unassigned" (project tag removed but tasks remain)

### Add/Edit Project Modal

- **Name** (required)
- **Color** — color picker (preset palette of ~8 colors that work with the dark theme: muted pink, lavender, mint, soft blue, gold, coral, sage, periwinkle)
- **Save / Cancel**

Project colors are used as small dots/chips on task cards in the Current Tasks view. Used subtly — never as full backgrounds, never as borders. Just a soft visual anchor.

---

## Section 4: Long-Term Goals

A separate section, structurally similar to Current Tasks but for life-scale goals.

### Header

- Page title: "Long-Term Goals"
- "+ Add Goal" button

### Goal List

A flat list of goal cards. Each card:

```
┌─────────────────────────────────────────────┐
│ ☐  Finish my Computer Science degree         │
│    Optional description / vision statement   │
└─────────────────────────────────────────────┘
```

Same single-click checkbox interaction as tasks. When completed:
- Strikethrough animation (slower, 400ms — these are life goals, savor it)
- Bigger confetti burst (~200 particles, 3s)
- Center-screen dialog: "A life goal complete. This is who you're becoming."
- Stays in the list with strikethrough — does NOT auto-archive. User can manually delete if they want.

### Add Goal Modal

- **Goal title** (required)
- **Description / vision** (optional)
- No dates, no progress %, no milestones, no project linking — keep it stripped down.

### Empty State

Same pattern as tasks — center-screen Goggins/Hormozi quote on the long view of life.

---

## Section 5: Settings

A dedicated page accessible from the sidebar bottom item. Organized into clearly labeled sections:

### Notifications

- **Master toggle:** Notifications ON / OFF
- **Per-category toggles:** Habits ON/OFF, Tasks ON/OFF, Goals ON/OFF
- **Active hours:** start time / end time pickers (default: 9:00 AM – 10:00 PM)
- **Frequency range:** "Notify every [1] to [2] hours, randomized" (sliders, default 1–2)
- **Test notification button:** fires a sample notification immediately

### Startup Behavior

- **Launch on Windows startup:** ON / OFF (uses `auto-launch`)
- **Start minimized to tray:** ON / OFF
- **Close to tray (vs quit):** ON / OFF (default ON — closing window keeps app running so notifications still fire)

### Quotes

- **Two tabs / sections:** Goggins / Hormozi
- Each shows the bundled quotes (sourced from real material — see Quotes section below)
- User can add new quotes (text + source attribution)
- User can edit or delete their own added quotes
- Bundled quotes are not deletable (but can be hidden via toggle)

### Claude API

- **API Key input** (password-style field, masked)
- "Test connection" button
- Used for monthly report generation
- If empty, monthly reports fall back to formula-based text (no AI narrative, just stats)

### Data

- **Export all data** button → produces a `.json` file with all habits, tasks, projects, goals, completion records, settings
- **Import** button (optional v1 — can be deferred) → restores from a JSON export
- **Database location:** display path (read-only, informational)

### About

- App version
- Link to issue reporting (placeholder for now)

---

## Notification System (Critical Detail)

### Daemon Architecture

The notification scheduler runs in the **Electron main process** (not the renderer). It must continue running when the window is minimized or closed-to-tray. It does NOT need to run when the app is fully quit.

### Scheduling Logic

```
Every 30 seconds, the scheduler checks:
  - Is the current time within active hours? If no, skip.
  - Has at least `nextDelayMs` elapsed since the last notification fired? If no, skip.
  - Are there any tasks/habits/goals eligible per the per-category toggles? If no, skip.
  - Pick a notification target:
      → Weight: 60% tasks, 30% habits (incomplete-today), 10% goals
      → Within tasks: prefer recently-added incomplete tasks
  - Fire native OS notification (Electron Notification API):
      → Title: the verbatim task/habit/goal text
      → Body: a randomly selected Goggins or Hormozi quote
  - Set `nextDelayMs` to a new random value between the configured min/max hours (in ms).
```

### Notification Content

- **Title line:** the actual task verbatim (e.g., "Finish Torgy.ai Tally form integration")
- **Body line:** the motivational quote
- Click action: focus the app and navigate to the relevant section

### When PC is inactive

Electron's main process pauses naturally when the OS suspends. No additional logic needed — when the PC wakes, the scheduler resumes; we don't need to fire missed notifications.

---

## Quotes Library

Bundle a JSON file at `data/quotes.json` with curated quotes from real sources. **You must research and source these from actual material:**

**David Goggins sources:**
- *Can't Hurt Me* (book)
- *Never Finished* (book)
- Joe Rogan Experience podcast appearances
- His Instagram captions (account: @davidgoggins)
- His own YouTube content

**Alex Hormozi sources:**
- *$100M Offers* (book)
- *$100M Leads* (book)
- His Twitter/X (@AlexHormozi)
- His Instagram (@hormozi)
- The Game podcast

Target: ~40 Goggins quotes + ~40 Hormozi quotes. Each quote object:

```json
{
  "id": "uuid",
  "author": "Goggins" | "Hormozi",
  "text": "exact quote",
  "source": "Can't Hurt Me, Ch. 4" | "Twitter, 2023" | "JRE #1080" | etc.,
  "bundled": true
}
```

**Important:** Do not fabricate quotes. If you are unsure whether a quote is authentic, leave it out. Better to have 60 verified quotes than 100 with hallucinations. When researching, prioritize quotes about discipline, consistency, focus, doing hard things, ignoring noise, and operator mentality.

---

## Database Schema (Suggested — Adjust as Needed)

```sql
-- Habits
CREATE TABLE habits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL,    -- JSON array: ["mon","tue","wed","thu","fri","sat","sun"]
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  archived_at INTEGER         -- soft delete; preserves historical data
);

-- Habit completions (one row per habit per day completed)
CREATE TABLE habit_completions (
  habit_id TEXT NOT NULL,
  date TEXT NOT NULL,          -- ISO date "YYYY-MM-DD"
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (habit_id, date),
  FOREIGN KEY (habit_id) REFERENCES habits(id)
);

-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Tasks
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id TEXT,             -- nullable
  created_at INTEGER NOT NULL,
  completed_at INTEGER,        -- nullable; if set, task is done
  archived_at INTEGER,         -- nullable; for soft delete
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Goals
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  archived_at INTEGER
);

-- Monthly reports
CREATE TABLE monthly_reports (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,         -- "YYYY-MM"
  generated_at INTEGER NOT NULL,
  tier INTEGER NOT NULL,       -- 1..6
  completion_pct REAL NOT NULL,
  narrative TEXT NOT NULL,     -- AI-generated or fallback text
  stats_json TEXT NOT NULL,    -- full stats payload
  UNIQUE (month)
);

-- Settings (key-value)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Quotes
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,        -- "Goggins" | "Hormozi"
  text TEXT NOT NULL,
  source TEXT NOT NULL,
  bundled INTEGER NOT NULL,    -- 0 or 1
  hidden INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL
);
```

---

## Monthly Report Generation

### Trigger

On every app launch:
1. Check if the previous calendar month has a report row.
2. If not (and at least one day of habit/task data exists for that month), generate one.

### Stats Computed (Formula-based)

- Overall completion % = total completed habit-cells / total applicable habit-cells for the month
- Best habit (highest completion %) and worst habit (lowest)
- Longest streak achieved during the month
- Total tasks completed during the month
- Per-project task breakdown (tasks completed per project)
- Comparison to previous month if exists: completion % delta, task volume delta

### AI Narrative

If a Claude API key is configured, call the API with a structured prompt:

```
System: You are a brutally honest but supportive coach in the voice of Alex Hormozi 
and David Goggins. Write a 3-4 sentence summary of this user's month. Acknowledge 
what they did well, call out what slipped, and tell them what to focus on next month. 
No fluff. No emojis. No bullet points. Just direct prose.

User: Here are the stats: [serialized stats]
```

Cache the response in the `monthly_reports.narrative` column. Never regenerate (the past is the past).

### Display

Renders below the Habit Scorecard grid when viewing that month. Card layout:
- Badge tier visual (top)
- Tier name + month + year (large heading)
- Narrative paragraph (body)
- Stats grid (overall %, best/worst habit, longest streak, tasks completed)
- Comparison delta (if applicable) at the bottom, small text

---

## Keyboard Shortcuts

- `Ctrl+1` → Habit Scorecard
- `Ctrl+2` → Current Tasks
- `Ctrl+3` → Projects
- `Ctrl+4` → Long-Term Goals
- `Ctrl+,` → Settings
- `Ctrl+N` → Add task (works from any screen; defaults to current section's add modal — tasks/habits/goals based on current page; on Habit Scorecard, opens Add Habit)
- `Esc` → Close any modal
- `Ctrl+Q` → Quit application (bypasses close-to-tray)

---

## Onboarding & First-Run

On first launch:
- Empty database, no demo data, no example habits
- App opens to Habit Scorecard with the empty-grid placeholder
- A center-screen Goggins/Hormozi quote sets the tone
- A subtle "Add your first habit" button below the quote
- No tour, no walkthrough, no tooltips, no popups — the user knows what they're doing

---

## System Tray

When closed (with close-to-tray enabled), the app lives in the system tray.

- Tray icon: a small pink-accented sigil matching the app's visual language
- Tray menu:
  - "Open Habit Tracker" (focuses window)
  - "Pause Notifications for 1 hour"
  - "Pause Notifications for today"
  - separator
  - "Quit"

---

## Quality Bar

- **Type safety:** strict TypeScript everywhere. No `any`. Use Drizzle's typed queries.
- **Error handling:** every IPC call wrapped with try/catch, errors surfaced to the user via subtle inline toast (no scary modal popups).
- **Loading states:** any operation > 100ms shows a subtle inline skeleton or pulse, never a spinner overlay.
- **Performance:** habit grid for 30 habits × 31 days must render in < 50ms. Use `React.memo` and stable keys aggressively.
- **Accessibility:** semantic HTML, keyboard navigation works everywhere, focus rings visible.
- **Persistence:** all writes are durable (SQLite syncs to disk). No data loss on crash or unexpected close.
- **Single-instance lock:** only one instance of the app can run at a time (Electron's `requestSingleInstanceLock`).

---

## Project Structure (Suggested)

```
habit-tracker/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Context bridge
│   ├── ipc/                 # Typed IPC handlers
│   ├── notifications.ts     # Notification daemon
│   ├── tray.ts              # System tray
│   ├── autoLaunch.ts        # Startup management
│   └── db/
│       ├── client.ts        # better-sqlite3 + Drizzle setup
│       ├── schema.ts        # Drizzle schema
│       └── queries/         # Typed query functions
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx         # Habit Scorecard
│   │   ├── tasks/
│   │   ├── projects/
│   │   ├── goals/
│   │   └── settings/
│   ├── components/
│   │   ├── ui/              # primitives (Button, Modal, Input...)
│   │   ├── habit-grid/
│   │   ├── task-card/
│   │   └── ...
│   ├── lib/
│   │   ├── ipc.ts           # typed IPC client
│   │   ├── store.ts         # Zustand stores
│   │   ├── confetti.ts
│   │   └── date.ts
│   └── styles/
│       └── globals.css
├── data/
│   └── quotes.json          # bundled Goggins/Hormozi quotes
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

---

## What "Done" Looks Like

The app is considered complete when:

1. I can add, edit, delete, and reorder daily habits with per-day-of-week schedules.
2. I can mark today's habits done with a satisfying flash + tiny confetti.
3. I can navigate months with smooth slide animation and see historical data.
4. Past months show their grid as read-only.
5. Streaks count correctly, accounting for non-applicable days.
6. The "Never miss twice" indicator appears when relevant.
7. Monthly totals at the bottom of the grid update live and accurately.
8. I can add, complete, and view tasks with the strikethrough + confetti dopamine loop.
9. Completed tasks auto-roll to the Completed view after midnight.
10. I can manage projects with colors, and tasks visually reflect project association.
11. I can add and complete long-term goals.
12. Native desktop notifications fire on schedule with the task text + quote.
13. The app minimizes to tray, launches on startup, and notifications keep working when minimized.
14. Monthly reports auto-generate on the 1st with AI narrative (if API key set) and tier badge.
15. All settings are functional and persist.
16. Data export produces a valid restorable JSON file.
17. All keyboard shortcuts work.
18. The empty-state and all-complete dopamine moments fire correctly with confetti + quotes.
19. The whole app feels fast, focused, and dark-modern. No flashy noise. Pure Hormozi clarity.
20. The app survives a force-quit and reopens with all data intact.

---

## Final Note

The user has been managing this with a paper journal. The bar isn't "match the journal" — the bar is *replace it permanently* by being **faster to log, more visible in progress, and more dopaminergic in feedback** than pen and paper. Every micro-interaction matters. The 200ms strikethrough has to feel like a pen stroke. The confetti has to feel earned. The empty state has to feel like a sniper rifle pointed at the next action.

Build accordingly.

When ready, present your plan. Then we build.
