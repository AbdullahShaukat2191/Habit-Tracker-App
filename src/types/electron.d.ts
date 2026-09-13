// Type declaration for window.electronAPI (exposed by Electron preload)
import type {
  Habit, HabitCompletion, Task, Project, Goal, MonthlyReport, Quote,
  WishlistItem,
  PaymentProject, PaymentMilestone, PaymentRecord,
  FinanceCategory, FinanceTransaction, FinanceSavingsEntry,
  CreateHabitInput, UpdateHabitInput,
  CreateTaskInput, UpdateTaskInput,
  CreateProjectInput, UpdateProjectInput,
  CreateGoalInput, UpdateGoalInput,
  CreateQuoteInput, UpdateQuoteInput,
  CreateWishlistInput, UpdateWishlistInput,
  CreatePaymentProjectInput, UpdatePaymentProjectInput,
  CreatePaymentMilestoneInput, UpdatePaymentMilestoneInput,
  CreatePaymentRecordInput,
  CreateFinanceCategoryInput, UpdateFinanceCategoryInput,
  CreateFinanceTransactionInput, UpdateFinanceTransactionInput,
  CreateFinanceSavingsEntryInput,
  SettingsMap, ToggleResult, QuoteAssignments,
  TimerSession, TimerSettings, TimerSegment,
} from '../../shared/types'

interface ElectronAPI {
  listHabits: () => Promise<Habit[]>
  createHabit: (input: CreateHabitInput) => Promise<Habit>
  updateHabit: (id: string, input: UpdateHabitInput) => Promise<Habit>
  deleteHabit: (id: string) => Promise<void>
  reorderHabits: (ids: string[]) => Promise<void>
  getHabitCompletions: (month: string) => Promise<HabitCompletion[]>
  getAllHabitCompletions: () => Promise<HabitCompletion[]>
  toggleHabitCompletion: (habitId: string, date: string) => Promise<ToggleResult>

  listTasks: () => Promise<Task[]>
  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (id: string, input: UpdateTaskInput) => Promise<Task>
  completeTask: (id: string) => Promise<Task>
  uncompleteTask: (id: string) => Promise<Task>
  pinTask: (id: string) => Promise<Task>
  unpinTask: (id: string) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  hardDeleteTask: (id: string) => Promise<void>

  listProjects: () => Promise<Project[]>
  createProject: (input: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, input: UpdateProjectInput) => Promise<Project>
  reorderProjects: (ids: string[]) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  listPaymentProjects: () => Promise<PaymentProject[]>
  createPaymentProject: (input: CreatePaymentProjectInput) => Promise<PaymentProject>
  importPaymentProjects: (projectIds: string[]) => Promise<PaymentProject[]>
  updatePaymentProject: (id: string, input: UpdatePaymentProjectInput) => Promise<PaymentProject>
  deletePaymentProject: (id: string) => Promise<void>

  listPaymentMilestones: () => Promise<PaymentMilestone[]>
  createPaymentMilestone: (paymentProjectId: string, input: CreatePaymentMilestoneInput) => Promise<PaymentMilestone>
  updatePaymentMilestone: (id: string, input: UpdatePaymentMilestoneInput) => Promise<PaymentMilestone>
  deletePaymentMilestone: (id: string) => Promise<void>
  togglePaymentMilestonePaid: (id: string) => Promise<PaymentMilestone>

  listPaymentRecords: () => Promise<PaymentRecord[]>
  createPaymentRecord: (paymentProjectId: string, input: CreatePaymentRecordInput) => Promise<PaymentRecord>
  deletePaymentRecord: (id: string) => Promise<void>

  listFinanceCategories: () => Promise<FinanceCategory[]>
  createFinanceCategory: (input: CreateFinanceCategoryInput) => Promise<FinanceCategory>
  updateFinanceCategory: (id: string, input: UpdateFinanceCategoryInput) => Promise<FinanceCategory>
  archiveFinanceCategory: (id: string) => Promise<void>
  listFinanceTransactions: () => Promise<FinanceTransaction[]>
  createFinanceTransaction: (input: CreateFinanceTransactionInput) => Promise<FinanceTransaction>
  updateFinanceTransaction: (id: string, input: UpdateFinanceTransactionInput) => Promise<FinanceTransaction>
  deleteFinanceTransaction: (id: string) => Promise<void>
  listFinanceSavingsEntries: () => Promise<FinanceSavingsEntry[]>
  createFinanceSavingsEntry: (input: CreateFinanceSavingsEntryInput) => Promise<FinanceSavingsEntry>
  deleteFinanceSavingsEntry: (id: string) => Promise<void>

  listGoals: () => Promise<Goal[]>
  createGoal: (input: CreateGoalInput) => Promise<Goal>
  updateGoal: (id: string, input: UpdateGoalInput) => Promise<Goal>
  reorderGoals: (ids: string[]) => Promise<void>
  completeGoal: (id: string) => Promise<Goal>
  uncompleteGoal: (id: string) => Promise<Goal>
  deleteGoal: (id: string) => Promise<void>

  listWishlistItems: () => Promise<WishlistItem[]>
  createWishlistItem: (input: CreateWishlistInput) => Promise<WishlistItem>
  updateWishlistItem: (id: string, input: UpdateWishlistInput) => Promise<WishlistItem>
  reorderWishlistItems: (ids: string[]) => Promise<void>
  completeWishlistItem: (id: string) => Promise<WishlistItem>
  uncompleteWishlistItem: (id: string) => Promise<WishlistItem>
  deleteWishlistItem: (id: string) => Promise<void>
  hardDeleteWishlistItem: (id: string) => Promise<void>

  getAllSettings: () => Promise<SettingsMap>
  setSetting: (key: string, value: string) => Promise<void>

  getReport: (month: string) => Promise<MonthlyReport | null>
  generateReport: (month: string) => Promise<MonthlyReport>
  testOpenAiKey: (apiKey: string) => Promise<{ ok: boolean; error?: string }>

  listQuotes: () => Promise<Quote[]>
  createQuote: (input: CreateQuoteInput) => Promise<Quote>
  updateQuote: (id: string, input: UpdateQuoteInput) => Promise<Quote>
  deleteQuote: (id: string) => Promise<void>
  toggleQuoteHidden: (id: string) => Promise<void>

  getAllQuoteAssignments: () => Promise<QuoteAssignments>
  setQuoteAssignment: (pageId: string, tabId: string, quoteId: string) => Promise<void>

  getTimerSessions: () => Promise<TimerSession[]>
  getTimerSessionsByProject: (projectId: string) => Promise<TimerSession[]>
  getActiveSession: () => Promise<TimerSession | null>
  createTimerSession: (projectId: string, name?: string) => Promise<TimerSession>
  pauseTimerSession: (id: string) => Promise<TimerSession>
  resumeTimerSession: (id: string) => Promise<TimerSession>
  stopTimerSession: (id: string) => Promise<TimerSession>
  renameTimerSession: (id: string, name: string) => Promise<TimerSession>
  deleteTimerSession: (id: string) => Promise<void>
  getTimerSettings: () => Promise<TimerSettings>
  updateTimerSettings: (hourlyRate: number, currency: string) => Promise<TimerSettings>
  getSegmentsBySession: (sessionId: string) => Promise<TimerSegment[]>
  getSegmentsForSessions: (sessionIds: string[]) => Promise<TimerSegment[]>
  setProjectHourlyRate: (projectId: string, rate: number | null) => Promise<void>

  getAppVersion: () => Promise<string>
  getDbPath: () => Promise<string>
  exportData: () => Promise<void>

  quit: () => Promise<void>
  testNotification: () => Promise<void>

  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  isWindowMaximized: () => Promise<boolean>
  closeWindow: () => Promise<void>
  onWindowMaximized: (callback: () => void) => void
  onWindowUnmaximized: (callback: () => void) => void
  removeWindowMaximizeListeners: () => void

  onNavigate: (callback: (section: string) => void) => void
  removeNavigateListener: () => void
  onReportReady: (callback: (month: string) => void) => void
  removeReportReadyListener: () => void

  zoomIn: () => Promise<void>
  zoomOut: () => Promise<void>
  zoomReset: () => Promise<void>
  onZoomChanged: (callback: (percent: number) => void) => void
  removeZoomChangedListener: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
