import type Database from 'better-sqlite3'

// Accepts the raw better-sqlite3 instance for DDL setup.
// For future schema changes, add ALTER TABLE statements here with existence checks.
export function runMigrations(sqlite: InstanceType<typeof Database>) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      archived_at INTEGER
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS habit_completions (
      habit_id TEXT NOT NULL,
      date TEXT NOT NULL,
      completed_at INTEGER NOT NULL,
      PRIMARY KEY (habit_id, date),
      FOREIGN KEY (habit_id) REFERENCES habits(id)
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      project_id TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      archived_at INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      archived_at INTEGER
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS monthly_reports (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL UNIQUE,
      generated_at INTEGER NOT NULL,
      tier INTEGER NOT NULL,
      completion_pct REAL NOT NULL,
      narrative TEXT NOT NULL,
      stats_json TEXT NOT NULL
    )
  `)

  // Add sort_order to projects table for existing databases
  try {
    sqlite.exec('ALTER TABLE projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0')
  } catch {
    // Column already exists — safe to ignore
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      author TEXT NOT NULL,
      text TEXT NOT NULL,
      bundled INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      added_at INTEGER NOT NULL
    )
  `)

  // Quotes now use a single free-text "author" field instead of a separate
  // "source" citation column — drop it for databases created before this change.
  try {
    sqlite.exec('ALTER TABLE quotes DROP COLUMN source')
  } catch {
    // Column already dropped (or table freshly created without it) — safe to ignore
  }

  // Add is_optional to habits for existing databases
  try {
    sqlite.exec('ALTER TABLE habits ADD COLUMN is_optional INTEGER NOT NULL DEFAULT 0')
  } catch {
    // Column already exists — safe to ignore
  }

  // Add is_optional to tasks for existing databases
  try {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN is_optional INTEGER NOT NULL DEFAULT 0')
  } catch {
    // Column already exists — safe to ignore
  }

  // Add pinned_at to tasks for existing databases (Today-tab pin/priority feature)
  try {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN pinned_at INTEGER')
  } catch {
    // Column already exists — safe to ignore
  }

  // Wishlist items table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      archived_at INTEGER
    )
  `)

  // Add sort_order to wishlist_items for existing databases, then backfill it
  // from createdAt order — but only on the run that actually adds the column,
  // so a later launch never clobbers a user's saved drag order back to createdAt.
  let addedWishlistSortOrder = false
  try {
    sqlite.exec('ALTER TABLE wishlist_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0')
    addedWishlistSortOrder = true
  } catch {
    // Column already exists — safe to ignore
  }
  if (addedWishlistSortOrder) {
    const rows = sqlite.prepare('SELECT id FROM wishlist_items ORDER BY created_at ASC').all() as { id: string }[]
    const updateOrder = sqlite.prepare('UPDATE wishlist_items SET sort_order = ? WHERE id = ?')
    sqlite.transaction(() => {
      rows.forEach((row, index) => updateOrder.run(index, row.id))
    })()
  }

  // Payments: paid-project catalogue, milestones, and the automated payment ledger
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payment_projects (
      id TEXT PRIMARY KEY,
      source_project_id TEXT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      developer TEXT,
      currency TEXT NOT NULL DEFAULT 'USD',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (source_project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
  `)

  // Add currency to payment_projects for existing databases
  try {
    sqlite.exec("ALTER TABLE payment_projects ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'")
  } catch {
    // Column already exists — safe to ignore
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payment_milestones (
      id TEXT PRIMARY KEY,
      payment_project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      paid_at INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (payment_project_id) REFERENCES payment_projects(id)
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payment_records (
      id TEXT PRIMARY KEY,
      payment_project_id TEXT NOT NULL,
      milestone_id TEXT,
      amount REAL NOT NULL,
      note TEXT,
      paid_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (payment_project_id) REFERENCES payment_projects(id),
      FOREIGN KEY (milestone_id) REFERENCES payment_milestones(id)
    )
  `)

  // Finance: categories, transactions, and the manual savings ledger
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS finance_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      archived_at INTEGER
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id TEXT,
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (category_id) REFERENCES finance_categories(id)
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS finance_savings_entries (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      note TEXT,
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)

  // Which quote is shown on a given page (+ optional tab). tab_id is '' (not
  // NULL) for pages with one page-wide quote, so (page_id, tab_id) can be a
  // reliable uniqueness key — NULL never equals NULL in SQL.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS quote_assignments (
      page_id TEXT NOT NULL,
      tab_id TEXT NOT NULL DEFAULT '',
      quote_id TEXT NOT NULL,
      PRIMARY KEY (page_id, tab_id)
    )
  `)

  // Timer: per-project work sessions, plus a single-row settings table for hourly rate/currency
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS timer_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT,
      started_at INTEGER NOT NULL,
      total_elapsed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      paused_at INTEGER,
      stopped_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS timer_settings (
      id TEXT PRIMARY KEY,
      hourly_rate REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'PKR'
    )
  `)

  // Per-project hourly rate (Timer feature only — nullable, falls back to the
  // global timer_settings.hourly_rate when unset)
  try {
    sqlite.exec('ALTER TABLE projects ADD COLUMN hourly_rate REAL')
  } catch {
    // Column already exists — safe to ignore
  }

  // Rate snapshot on sessions — backfill pre-migration sessions from the single
  // global rate that was in effect before per-session rates existed (the exact
  // number the old UI used to compute their earnings), but only on the run that
  // actually adds the column, so a later manual per-session rate correction is
  // never silently overwritten on a subsequent launch.
  let addedRateSnapshot = false
  try {
    sqlite.exec('ALTER TABLE timer_sessions ADD COLUMN rate_snapshot REAL NOT NULL DEFAULT 0')
    addedRateSnapshot = true
  } catch {
    // Column already exists — safe to ignore
  }
  if (addedRateSnapshot) {
    const defaultRate = sqlite.prepare("SELECT hourly_rate FROM timer_settings WHERE id = 'default'").get() as { hourly_rate: number } | undefined
    if (defaultRate) {
      sqlite.prepare('UPDATE timer_sessions SET rate_snapshot = ?').run(defaultRate.hourly_rate)
    }
  }

  // Segment-level pause/resume detail. Sessions created before this migration have
  // no rows here — every read path must fall back to startedAt/stoppedAt for From/To.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS timer_segments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES timer_sessions(id)
    )
  `)
}
