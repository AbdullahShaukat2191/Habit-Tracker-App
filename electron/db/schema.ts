import { text, integer, real, primaryKey, sqliteTable } from 'drizzle-orm/sqlite-core'

export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  schedule: text('schedule').notNull(), // JSON: DayAbbreviation[]
  sortOrder: integer('sort_order').notNull(),
  createdAt: integer('created_at').notNull(),
  archivedAt: integer('archived_at'),
  isOptional: integer('is_optional', { mode: 'boolean' }).notNull().default(false),
})

export const habitCompletions = sqliteTable('habit_completions', {
  habitId: text('habit_id').notNull().references(() => habits.id),
  date: text('date').notNull(), // 'YYYY-MM-DD'
  completedAt: integer('completed_at').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.habitId, t.date] }),
}))

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
})

export const paymentProjects = sqliteTable('payment_projects', {
  id: text('id').primaryKey(),
  sourceProjectId: text('source_project_id').references(() => projects.id),
  name: text('name').notNull(),
  color: text('color').notNull(),
  totalAmount: real('total_amount').notNull().default(0),
  developer: text('developer'),
  currency: text('currency').notNull().default('USD'),
  createdAt: integer('created_at').notNull(),
})

export const paymentMilestones = sqliteTable('payment_milestones', {
  id: text('id').primaryKey(),
  paymentProjectId: text('payment_project_id').notNull().references(() => paymentProjects.id),
  title: text('title').notNull(),
  description: text('description'),
  amount: real('amount').notNull(),
  paid: integer('paid', { mode: 'boolean' }).notNull().default(false),
  paidAt: integer('paid_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
})

export const paymentRecords = sqliteTable('payment_records', {
  id: text('id').primaryKey(),
  paymentProjectId: text('payment_project_id').notNull().references(() => paymentProjects.id),
  milestoneId: text('milestone_id').references(() => paymentMilestones.id),
  amount: real('amount').notNull(),
  note: text('note'),
  paidAt: integer('paid_at').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  projectId: text('project_id').references(() => projects.id),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
  archivedAt: integer('archived_at'),
  isOptional: integer('is_optional', { mode: 'boolean' }).notNull().default(false),
})

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
  archivedAt: integer('archived_at'),
})

export const monthlyReports = sqliteTable('monthly_reports', {
  id: text('id').primaryKey(),
  month: text('month').notNull().unique(), // 'YYYY-MM'
  generatedAt: integer('generated_at').notNull(),
  tier: integer('tier').notNull(), // 1–6
  completionPct: real('completion_pct').notNull(),
  narrative: text('narrative').notNull(),
  statsJson: text('stats_json').notNull(),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey(),
  author: text('author').notNull(), // free-text attribution, e.g. 'David Goggins'
  text: text('text').notNull(),
  bundled: integer('bundled', { mode: 'boolean' }).notNull().default(false),
  hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
  addedAt: integer('added_at').notNull(),
})

// Which quote is displayed on a given page (and, optionally, a specific tab
// within it). tabId is '' (not null) for pages with a single page-wide quote —
// a NOT NULL sentinel avoids SQL's NULL-never-equals-NULL breaking the
// (pageId, tabId) uniqueness this table relies on.
export const quoteAssignments = sqliteTable('quote_assignments', {
  pageId: text('page_id').notNull(),
  tabId: text('tab_id').notNull().default(''),
  quoteId: text('quote_id').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.pageId, t.tabId] }),
}))

export const wishlistItems = sqliteTable('wishlist_items', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
  archivedAt: integer('archived_at'),
})

export const financeCategories = sqliteTable('finance_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  archivedAt: integer('archived_at'),
})

export const financeTransactions = sqliteTable('finance_transactions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  amount: real('amount').notNull(),
  categoryId: text('category_id').references(() => financeCategories.id),
  date: text('date').notNull(), // 'YYYY-MM-DD'
  createdAt: integer('created_at').notNull(),
})

export const financeSavingsEntries = sqliteTable('finance_savings_entries', {
  id: text('id').primaryKey(),
  amount: real('amount').notNull(),
  note: text('note'),
  date: text('date').notNull(), // 'YYYY-MM-DD'
  createdAt: integer('created_at').notNull(),
})
