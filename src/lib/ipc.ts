// Typed wrapper around window.electronAPI.
// All renderer code imports from here — never calls window.electronAPI directly.

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
  SettingsMap, ToggleResult,
} from '../../shared/types'

function api() {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error('window.electronAPI is not available. Are you in an Electron renderer?')
  }
  return window.electronAPI
}

// Habits
export const listHabits = (): Promise<Habit[]> => api().listHabits()
export const createHabit = (input: CreateHabitInput): Promise<Habit> => api().createHabit(input)
export const updateHabit = (id: string, input: UpdateHabitInput): Promise<Habit> => api().updateHabit(id, input)
export const deleteHabit = (id: string): Promise<void> => api().deleteHabit(id)
export const reorderHabits = (ids: string[]): Promise<void> => api().reorderHabits(ids)
export const getHabitCompletions = (month: string): Promise<HabitCompletion[]> => api().getHabitCompletions(month)
export const getAllHabitCompletions = (): Promise<HabitCompletion[]> => api().getAllHabitCompletions()
export const toggleHabitCompletion = (habitId: string, date: string): Promise<ToggleResult> =>
  api().toggleHabitCompletion(habitId, date)

// Tasks
export const listTasks = (): Promise<Task[]> => api().listTasks()
export const createTask = (input: CreateTaskInput): Promise<Task> => api().createTask(input)
export const updateTask = (id: string, input: UpdateTaskInput): Promise<Task> => api().updateTask(id, input)
export const completeTask = (id: string): Promise<Task> => api().completeTask(id)
export const deleteTask = (id: string): Promise<void> => api().deleteTask(id)
export const hardDeleteTask = (id: string): Promise<void> => api().hardDeleteTask(id)
export const uncompleteTask = (id: string): Promise<Task> => api().uncompleteTask(id)

// Projects
export const listProjects = (): Promise<Project[]> => api().listProjects()
export const createProject = (input: CreateProjectInput): Promise<Project> => api().createProject(input)
export const updateProject = (id: string, input: UpdateProjectInput): Promise<Project> => api().updateProject(id, input)
export const reorderProjects = (ids: string[]): Promise<void> => api().reorderProjects(ids)
export const deleteProject = (id: string): Promise<void> => api().deleteProject(id)

// Payment Projects
export const listPaymentProjects = (): Promise<PaymentProject[]> => api().listPaymentProjects()
export const createPaymentProject = (input: CreatePaymentProjectInput): Promise<PaymentProject> => api().createPaymentProject(input)
export const importPaymentProjects = (projectIds: string[]): Promise<PaymentProject[]> => api().importPaymentProjects(projectIds)
export const updatePaymentProject = (id: string, input: UpdatePaymentProjectInput): Promise<PaymentProject> => api().updatePaymentProject(id, input)
export const deletePaymentProject = (id: string): Promise<void> => api().deletePaymentProject(id)

// Payment Milestones
export const listPaymentMilestones = (): Promise<PaymentMilestone[]> => api().listPaymentMilestones()
export const createPaymentMilestone = (paymentProjectId: string, input: CreatePaymentMilestoneInput): Promise<PaymentMilestone> => api().createPaymentMilestone(paymentProjectId, input)
export const updatePaymentMilestone = (id: string, input: UpdatePaymentMilestoneInput): Promise<PaymentMilestone> => api().updatePaymentMilestone(id, input)
export const deletePaymentMilestone = (id: string): Promise<void> => api().deletePaymentMilestone(id)
export const togglePaymentMilestonePaid = (id: string): Promise<PaymentMilestone> => api().togglePaymentMilestonePaid(id)

// Payment Records
export const listPaymentRecords = (): Promise<PaymentRecord[]> => api().listPaymentRecords()
export const createPaymentRecord = (paymentProjectId: string, input: CreatePaymentRecordInput): Promise<PaymentRecord> => api().createPaymentRecord(paymentProjectId, input)
export const deletePaymentRecord = (id: string): Promise<void> => api().deletePaymentRecord(id)

// Goals
export const listGoals = (): Promise<Goal[]> => api().listGoals()
export const createGoal = (input: CreateGoalInput): Promise<Goal> => api().createGoal(input)
export const updateGoal = (id: string, input: UpdateGoalInput): Promise<Goal> => api().updateGoal(id, input)
export const completeGoal = (id: string): Promise<Goal> => api().completeGoal(id)
export const deleteGoal = (id: string): Promise<void> => api().deleteGoal(id)

// Settings
export const getAllSettings = (): Promise<SettingsMap> => api().getAllSettings()
export const setSetting = (key: string, value: string): Promise<void> => api().setSetting(key, value)

// Reports
export const getReport = (month: string): Promise<MonthlyReport | null> => api().getReport(month)
export const generateReport = (month: string): Promise<MonthlyReport> => api().generateReport(month)
export const testOpenAiKey = (apiKey: string): Promise<{ ok: boolean; error?: string }> => api().testOpenAiKey(apiKey)

// Quotes
export const listQuotes = (): Promise<Quote[]> => api().listQuotes()
export const createQuote = (input: CreateQuoteInput): Promise<Quote> => api().createQuote(input)
export const updateQuote = (id: string, input: UpdateQuoteInput): Promise<Quote> => api().updateQuote(id, input)
export const deleteQuote = (id: string): Promise<void> => api().deleteQuote(id)
export const toggleQuoteHidden = (id: string): Promise<void> => api().toggleQuoteHidden(id)

// App
export const getAppVersion = (): Promise<string> => api().getAppVersion()
export const getDbPath = (): Promise<string> => api().getDbPath()
export const exportData = (): Promise<void> => api().exportData()

// App control
export const quit = (): Promise<void> => api().quit()
export const testNotification = (): Promise<void> => api().testNotification()

// Window controls
export const minimizeWindow = (): Promise<void> => api().minimizeWindow()
export const maximizeWindow = (): Promise<void> => api().maximizeWindow()
export const isWindowMaximized = (): Promise<boolean> => api().isWindowMaximized()
export const closeWindow = (): Promise<void> => api().closeWindow()
export const onWindowMaximized = (cb: () => void) => api().onWindowMaximized(cb)
export const onWindowUnmaximized = (cb: () => void) => api().onWindowUnmaximized(cb)
export const removeWindowMaximizeListeners = () => api().removeWindowMaximizeListeners()

// Events
export const onNavigate = (cb: (section: string) => void) => api().onNavigate(cb)
export const removeNavigateListener = () => api().removeNavigateListener()
export const onReportReady = (cb: (month: string) => void) => api().onReportReady(cb)
export const removeReportReadyListener = () => api().removeReportReadyListener()

// Wishlist
export const listWishlistItems = (): Promise<WishlistItem[]> => api().listWishlistItems()
export const createWishlistItem = (input: CreateWishlistInput): Promise<WishlistItem> => api().createWishlistItem(input)
export const updateWishlistItem = (id: string, input: UpdateWishlistInput): Promise<WishlistItem> => api().updateWishlistItem(id, input)
export const completeWishlistItem = (id: string): Promise<WishlistItem> => api().completeWishlistItem(id)
export const uncompleteWishlistItem = (id: string): Promise<WishlistItem> => api().uncompleteWishlistItem(id)
export const deleteWishlistItem = (id: string): Promise<void> => api().deleteWishlistItem(id)
export const hardDeleteWishlistItem = (id: string): Promise<void> => api().hardDeleteWishlistItem(id)

// Finance Categories
export const listFinanceCategories = (): Promise<FinanceCategory[]> => api().listFinanceCategories()
export const createFinanceCategory = (input: CreateFinanceCategoryInput): Promise<FinanceCategory> => api().createFinanceCategory(input)
export const updateFinanceCategory = (id: string, input: UpdateFinanceCategoryInput): Promise<FinanceCategory> => api().updateFinanceCategory(id, input)
export const archiveFinanceCategory = (id: string): Promise<void> => api().archiveFinanceCategory(id)

// Finance Transactions
export const listFinanceTransactions = (): Promise<FinanceTransaction[]> => api().listFinanceTransactions()
export const createFinanceTransaction = (input: CreateFinanceTransactionInput): Promise<FinanceTransaction> => api().createFinanceTransaction(input)
export const updateFinanceTransaction = (id: string, input: UpdateFinanceTransactionInput): Promise<FinanceTransaction> => api().updateFinanceTransaction(id, input)
export const deleteFinanceTransaction = (id: string): Promise<void> => api().deleteFinanceTransaction(id)

// Finance Savings
export const listFinanceSavingsEntries = (): Promise<FinanceSavingsEntry[]> => api().listFinanceSavingsEntries()
export const createFinanceSavingsEntry = (input: CreateFinanceSavingsEntryInput): Promise<FinanceSavingsEntry> => api().createFinanceSavingsEntry(input)
export const deleteFinanceSavingsEntry = (id: string): Promise<void> => api().deleteFinanceSavingsEntry(id)
