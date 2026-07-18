import { contextBridge, ipcRenderer } from 'electron'
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
} from '../shared/types'

const api = {
  // --- Habits ---
  listHabits: (): Promise<Habit[]> =>
    ipcRenderer.invoke('habits:list'),
  createHabit: (input: CreateHabitInput): Promise<Habit> =>
    ipcRenderer.invoke('habits:create', input),
  updateHabit: (id: string, input: UpdateHabitInput): Promise<Habit> =>
    ipcRenderer.invoke('habits:update', id, input),
  deleteHabit: (id: string): Promise<void> =>
    ipcRenderer.invoke('habits:delete', id),
  reorderHabits: (ids: string[]): Promise<void> =>
    ipcRenderer.invoke('habits:reorder', ids),
  getHabitCompletions: (month: string): Promise<HabitCompletion[]> =>
    ipcRenderer.invoke('habits:completions', month),
  toggleHabitCompletion: (habitId: string, date: string): Promise<ToggleResult> =>
    ipcRenderer.invoke('habits:toggle', habitId, date),

  // --- Tasks ---
  listTasks: (): Promise<Task[]> =>
    ipcRenderer.invoke('tasks:list'),
  createTask: (input: CreateTaskInput): Promise<Task> =>
    ipcRenderer.invoke('tasks:create', input),
  updateTask: (id: string, input: UpdateTaskInput): Promise<Task> =>
    ipcRenderer.invoke('tasks:update', id, input),
  completeTask: (id: string): Promise<Task> =>
    ipcRenderer.invoke('tasks:complete', id),
  deleteTask: (id: string): Promise<void> =>
    ipcRenderer.invoke('tasks:delete', id),
  hardDeleteTask: (id: string): Promise<void> =>
    ipcRenderer.invoke('tasks:hard-delete', id),
  uncompleteTask: (id: string): Promise<Task> =>
    ipcRenderer.invoke('tasks:uncomplete', id),

  // --- Projects ---
  listProjects: (): Promise<Project[]> =>
    ipcRenderer.invoke('projects:list'),
  createProject: (input: CreateProjectInput): Promise<Project> =>
    ipcRenderer.invoke('projects:create', input),
  updateProject: (id: string, input: UpdateProjectInput): Promise<Project> =>
    ipcRenderer.invoke('projects:update', id, input),
  reorderProjects: (ids: string[]): Promise<void> =>
    ipcRenderer.invoke('projects:reorder', ids),
  deleteProject: (id: string): Promise<void> =>
    ipcRenderer.invoke('projects:delete', id),

  // --- Payment Projects ---
  listPaymentProjects: (): Promise<PaymentProject[]> =>
    ipcRenderer.invoke('paymentProjects:list'),
  createPaymentProject: (input: CreatePaymentProjectInput): Promise<PaymentProject> =>
    ipcRenderer.invoke('paymentProjects:create', input),
  importPaymentProjects: (projectIds: string[]): Promise<PaymentProject[]> =>
    ipcRenderer.invoke('paymentProjects:import', projectIds),
  updatePaymentProject: (id: string, input: UpdatePaymentProjectInput): Promise<PaymentProject> =>
    ipcRenderer.invoke('paymentProjects:update', id, input),
  deletePaymentProject: (id: string): Promise<void> =>
    ipcRenderer.invoke('paymentProjects:delete', id),

  // --- Payment Milestones ---
  listPaymentMilestones: (): Promise<PaymentMilestone[]> =>
    ipcRenderer.invoke('paymentMilestones:list'),
  createPaymentMilestone: (paymentProjectId: string, input: CreatePaymentMilestoneInput): Promise<PaymentMilestone> =>
    ipcRenderer.invoke('paymentMilestones:create', paymentProjectId, input),
  updatePaymentMilestone: (id: string, input: UpdatePaymentMilestoneInput): Promise<PaymentMilestone> =>
    ipcRenderer.invoke('paymentMilestones:update', id, input),
  deletePaymentMilestone: (id: string): Promise<void> =>
    ipcRenderer.invoke('paymentMilestones:delete', id),
  togglePaymentMilestonePaid: (id: string): Promise<PaymentMilestone> =>
    ipcRenderer.invoke('paymentMilestones:togglePaid', id),

  // --- Payment Records ---
  listPaymentRecords: (): Promise<PaymentRecord[]> =>
    ipcRenderer.invoke('paymentRecords:list'),
  createPaymentRecord: (paymentProjectId: string, input: CreatePaymentRecordInput): Promise<PaymentRecord> =>
    ipcRenderer.invoke('paymentRecords:create', paymentProjectId, input),
  deletePaymentRecord: (id: string): Promise<void> =>
    ipcRenderer.invoke('paymentRecords:delete', id),

  // --- Goals ---
  listGoals: (): Promise<Goal[]> =>
    ipcRenderer.invoke('goals:list'),
  createGoal: (input: CreateGoalInput): Promise<Goal> =>
    ipcRenderer.invoke('goals:create', input),
  updateGoal: (id: string, input: UpdateGoalInput): Promise<Goal> =>
    ipcRenderer.invoke('goals:update', id, input),
  completeGoal: (id: string): Promise<Goal> =>
    ipcRenderer.invoke('goals:complete', id),
  deleteGoal: (id: string): Promise<void> =>
    ipcRenderer.invoke('goals:delete', id),

  // --- Wishlist ---
  listWishlistItems: (): Promise<WishlistItem[]> =>
    ipcRenderer.invoke('wishlist:list'),
  createWishlistItem: (input: CreateWishlistInput): Promise<WishlistItem> =>
    ipcRenderer.invoke('wishlist:create', input),
  updateWishlistItem: (id: string, input: UpdateWishlistInput): Promise<WishlistItem> =>
    ipcRenderer.invoke('wishlist:update', id, input),
  completeWishlistItem: (id: string): Promise<WishlistItem> =>
    ipcRenderer.invoke('wishlist:complete', id),
  uncompleteWishlistItem: (id: string): Promise<WishlistItem> =>
    ipcRenderer.invoke('wishlist:uncomplete', id),
  deleteWishlistItem: (id: string): Promise<void> =>
    ipcRenderer.invoke('wishlist:delete', id),
  hardDeleteWishlistItem: (id: string): Promise<void> =>
    ipcRenderer.invoke('wishlist:hard-delete', id),

  // --- Settings ---
  getAllSettings: (): Promise<SettingsMap> =>
    ipcRenderer.invoke('settings:getAll'),
  setSetting: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('settings:set', key, value),

  // --- Reports ---
  getReport: (month: string): Promise<MonthlyReport | null> =>
    ipcRenderer.invoke('reports:get', month),
  generateReport: (month: string): Promise<MonthlyReport> =>
    ipcRenderer.invoke('reports:generate', month),
  testOpenAiKey: (apiKey: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('reports:testOpenAiKey', apiKey),

  // --- Quotes ---
  listQuotes: (): Promise<Quote[]> =>
    ipcRenderer.invoke('quotes:list'),
  createQuote: (input: CreateQuoteInput): Promise<Quote> =>
    ipcRenderer.invoke('quotes:create', input),
  updateQuote: (id: string, input: UpdateQuoteInput): Promise<Quote> =>
    ipcRenderer.invoke('quotes:update', id, input),
  deleteQuote: (id: string): Promise<void> =>
    ipcRenderer.invoke('quotes:delete', id),
  toggleQuoteHidden: (id: string): Promise<void> =>
    ipcRenderer.invoke('quotes:toggleHidden', id),

  // --- App ---
  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:version'),
  getDbPath: (): Promise<string> =>
    ipcRenderer.invoke('app:dbPath'),
  exportData: (): Promise<void> =>
    ipcRenderer.invoke('app:exportData'),

  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
  testNotification: (): Promise<void> => ipcRenderer.invoke('notifications:test'),

  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  isWindowMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  onWindowMaximized: (callback: () => void) => ipcRenderer.on('window:maximized', callback),
  onWindowUnmaximized: (callback: () => void) => ipcRenderer.on('window:unmaximized', callback),
  removeWindowMaximizeListeners: () => {
    ipcRenderer.removeAllListeners('window:maximized')
    ipcRenderer.removeAllListeners('window:unmaximized')
  },

  // --- Navigation from main process ---
  onNavigate: (callback: (section: string) => void) => {
    ipcRenderer.on('navigate', (_event, section: string) => callback(section))
  },
  removeNavigateListener: () => {
    ipcRenderer.removeAllListeners('navigate')
  },

  // --- Report ready notification ---
  onReportReady: (callback: (month: string) => void) => {
    ipcRenderer.on('report:ready', (_event, month: string) => callback(month))
  },
  removeReportReadyListener: () => {
    ipcRenderer.removeAllListeners('report:ready')
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

// Type declaration for the renderer
declare global {
  interface Window {
    electronAPI: typeof api
  }
}
