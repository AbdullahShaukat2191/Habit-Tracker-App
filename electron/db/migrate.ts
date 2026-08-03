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
      source TEXT NOT NULL,
      bundled INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      added_at INTEGER NOT NULL
    )
  `)

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

  // Wishlist items table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      archived_at INTEGER
    )
  `)

  // Payments: paid-project catalogue, milestones, and the automated payment ledger
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payment_projects (
      id TEXT PRIMARY KEY,
      source_project_id TEXT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      developer TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (source_project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
  `)

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
}
