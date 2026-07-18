// Type declaration for window.electronAPI (exposed by Electron preload)
import type {
  Habit, HabitCompletion, Task, Project, Goal, MonthlyReport, Quote,
  WishlistItem,
  PaymentProject, PaymentMilestone, PaymentRecord,
  CreateHabitInput, UpdateHabitInput,
  CreateTaskInput, UpdateTaskInput,
  CreateProjectInput, UpdateProjectInput,
  CreateGoalInput, UpdateGoalInput,
  CreateQuoteInput, UpdateQuoteInput,
  CreateWishlistInput, UpdateWishlistInput,
  CreatePaymentProjectInput, UpdatePaymentProjectInput,
  CreatePaymentMilestoneInput, UpdatePaymentMilestoneInput,
  CreatePaymentRecordInput,
  SettingsMap, ToggleResult,
} from '../../shared/types'

interface ElectronAPI {
  listHabits: () => Promise<Habit[]>
  createHabit: (input: CreateHabitInput) => Promise<Habit>
  updateHabit: (id: string, input: UpdateHabitInput) => Promise<Habit>
  deleteHabit: (id: string) => Promise<void>
  reorderHabits: (ids: string[]) => Promise<void>
  getHabitCompletions: (month: string) => Promise<HabitCompletion[]>
  toggleHabitCompletion: (habitId: string, date: string) => Promise<ToggleResult>

  listTasks: () => Promise<Task[]>
  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (id: string, input: UpdateTaskInput) => Promise<Task>
  completeTask: (id: string) => Promise<Task>
  uncompleteTask: (id: string) => Promise<Task>
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

  listGoals: () => Promise<Goal[]>
  createGoal: (input: CreateGoalInput) => Promise<Goal>
  updateGoal: (id: string, input: UpdateGoalInput) => Promise<Goal>
  completeGoal: (id: string) => Promise<Goal>
  deleteGoal: (id: string) => Promise<void>

  listWishlistItems: () => Promise<WishlistItem[]>
  createWishlistItem: (input: CreateWishlistInput) => Promise<WishlistItem>
  updateWishlistItem: (id: string, input: UpdateWishlistInput) => Promise<WishlistItem>
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
