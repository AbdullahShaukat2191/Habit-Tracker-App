export type DayAbbreviation = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface Habit {
  id: string
  name: string
  schedule: DayAbbreviation[]
  sortOrder: number
  createdAt: number
  archivedAt: number | null
  isOptional: boolean
}

export interface HabitCompletion {
  habitId: string
  date: string // 'YYYY-MM-DD'
  completedAt: number
}

export interface Task {
  id: string
  title: string
  description: string | null
  projectId: string | null
  createdAt: number
  completedAt: number | null
  archivedAt: number | null
  isOptional: boolean
}

export interface Project {
  id: string
  name: string
  color: string
  sortOrder: number
  createdAt: number
}

export interface Goal {
  id: string
  title: string
  description: string | null
  sortOrder: number
  createdAt: number
  completedAt: number | null
  archivedAt: number | null
}

export interface WishlistItem {
  id: string
  title: string
  description: string | null
  sortOrder: number
  createdAt: number
  completedAt: number | null
  archivedAt: number | null
}

export interface CreateWishlistInput {
  title: string
  description?: string
}

export interface UpdateWishlistInput {
  title?: string
  description?: string
}

// --- Finance ---

export interface FinanceCategory {
  id: string
  name: string
  color: string
  sortOrder: number
  createdAt: number
  archivedAt: number | null
}

export interface FinanceTransaction {
  id: string
  title: string
  amount: number
  categoryId: string | null
  date: string // 'YYYY-MM-DD'
  createdAt: number
}

export interface FinanceSavingsEntry {
  id: string
  amount: number
  note: string | null
  date: string // 'YYYY-MM-DD'
  createdAt: number
}

export interface CreateFinanceCategoryInput {
  name: string
  color: string
}

export interface UpdateFinanceCategoryInput {
  name?: string
  color?: string
}

export interface CreateFinanceTransactionInput {
  title: string
  amount: number
  categoryId?: string | null
  date: string
}

export interface UpdateFinanceTransactionInput {
  title?: string
  amount?: number
  categoryId?: string | null
  date?: string
}

export interface CreateFinanceSavingsEntryInput {
  amount: number
  note?: string
  date: string
}

export interface MonthlyReport {
  id: string
  month: string // 'YYYY-MM'
  generatedAt: number
  tier: number // 1–6
  completionPct: number
  narrative: string
  statsJson: string
}

export interface Quote {
  id: string
  author: string
  text: string
  bundled: boolean
  hidden: boolean
  addedAt: number
}

// Which quote is shown on a given page (+ optional tab, '' if the page has
// only one page-wide quote). Keyed as `${pageId}:${tabId}` on the wire.
export type QuoteAssignments = Record<string, string>

// IPC payload types
export interface CreateHabitInput {
  name: string
  schedule: DayAbbreviation[]
  isOptional?: boolean
}

export interface UpdateHabitInput {
  name?: string
  schedule?: DayAbbreviation[]
  isOptional?: boolean
}

export interface CreateTaskInput {
  title: string
  description?: string
  projectId?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  projectId?: string | null
  isOptional?: boolean
}

export interface CreateProjectInput {
  name: string
  color: string
}

export interface UpdateProjectInput {
  name?: string
  color?: string
}

// --- Payments ---

export interface PaymentProject {
  id: string
  sourceProjectId: string | null
  name: string
  color: string
  totalAmount: number
  developer: string | null
  currency: string
  createdAt: number
}

export interface PaymentMilestone {
  id: string
  paymentProjectId: string
  title: string
  description: string | null
  amount: number
  paid: boolean
  paidAt: number | null
  sortOrder: number
  createdAt: number
}

export interface PaymentRecord {
  id: string
  paymentProjectId: string
  milestoneId: string | null
  amount: number
  note: string | null
  paidAt: number
  createdAt: number
}

export interface CreatePaymentProjectInput {
  name: string
  color: string
  totalAmount?: number
  developer?: string
  currency?: string
}

export interface UpdatePaymentProjectInput {
  name?: string
  color?: string
  totalAmount?: number
  developer?: string | null
  currency?: string
}

export interface CreatePaymentMilestoneInput {
  title: string
  description?: string
  amount: number
}

export interface UpdatePaymentMilestoneInput {
  title?: string
  description?: string
  amount?: number
}

export interface CreatePaymentRecordInput {
  amount: number
  note?: string
}

export interface CreateGoalInput {
  title: string
  description?: string
}

export interface UpdateGoalInput {
  title?: string
  description?: string
}

export interface CreateQuoteInput {
  author: string
  text: string
}

export interface UpdateQuoteInput {
  text?: string
  author?: string
}

export type SettingsMap = Record<string, string>

export type ToggleResult = 'completed' | 'uncompleted'

// Default settings keys
export const SETTING_KEYS = {
  NOTIFICATIONS_ENABLED: 'notifications_enabled',
  NOTIFY_HABITS: 'notify_habits',
  NOTIFY_TASKS: 'notify_tasks',
  NOTIFY_GOALS: 'notify_goals',
  NOTIFY_ACTIVE_START: 'notify_active_start', // 'HH:mm'
  NOTIFY_ACTIVE_END: 'notify_active_end',     // 'HH:mm'
  NOTIFY_MIN_HOURS: 'notify_min_hours',
  NOTIFY_MAX_HOURS: 'notify_max_hours',
  NOTIFY_NEXT_FIRE_AT: 'notify_next_fire_at', // epoch ms; persists the countdown across restarts
  LAUNCH_ON_STARTUP: 'launch_on_startup',
  START_MINIMIZED: 'start_minimized',
  CLOSE_TO_TRAY: 'close_to_tray',
  OPENAI_API_KEY: 'openai_api_key',
  BACKFILL_HABITS: 'backfill_habits',
  SHORTCUT_ADD: 'shortcut_add',
  SHORTCUT_NAV_HABITS: 'shortcut_nav_habits',
  SHORTCUT_NAV_TASKS: 'shortcut_nav_tasks',
  SHORTCUT_NAV_PROJECTS: 'shortcut_nav_projects',
  SHORTCUT_NAV_GOALS: 'shortcut_nav_goals',
  SHORTCUT_NAV_WISHLIST: 'shortcut_nav_wishlist',
  SHORTCUT_NAV_SETTINGS: 'shortcut_nav_settings',
  SHORTCUT_QUIT: 'shortcut_quit',
  MONTHLY_BUDGET: 'monthly_budget',
  FINANCE_CURRENCY: 'finance_currency',
} as const
