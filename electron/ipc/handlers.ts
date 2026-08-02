import { ipcMain, app, dialog, BrowserWindow, Notification } from 'electron'
import * as habitQueries from '../db/queries/habits'
import * as taskQueries from '../db/queries/tasks'
import * as projectQueries from '../db/queries/projects'
import * as goalQueries from '../db/queries/goals'
import * as settingQueries from '../db/queries/settings'
import * as reportQueries from '../db/queries/reports'
import * as quoteQueries from '../db/queries/quotes'
import * as wishlistQueries from '../db/queries/wishlist'
import * as paymentQueries from '../db/queries/payments'
import { getDbPath } from '../db/client'
import fs from 'fs'
import path from 'path'

function handle<T>(channel: string, fn: (...args: any[]) => T | Promise<T>) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await fn(...args)
    } catch (err) {
      console.error(`IPC error on channel "${channel}":`, err)
      throw err // rethrow so renderer gets the error
    }
  })
}

export function registerAllHandlers() {
  // Habits
  handle('habits:list', () => habitQueries.listHabits())
  handle('habits:create', (input) => habitQueries.createHabit(input))
  handle('habits:update', (id, input) => habitQueries.updateHabit(id, input))
  handle('habits:delete', (id) => habitQueries.deleteHabit(id))
  handle('habits:reorder', (ids) => habitQueries.reorderHabits(ids))
  handle('habits:completions', (month) => habitQueries.getHabitCompletions(month))
  handle('habits:allCompletions', () => habitQueries.getAllHabitCompletions())
  handle('habits:toggle', (habitId, date) => habitQueries.toggleHabitCompletion(habitId, date))

  // Tasks
  handle('tasks:list', () => taskQueries.listTasks())
  handle('tasks:create', (input) => taskQueries.createTask(input))
  handle('tasks:update', (id, input) => taskQueries.updateTask(id, input))
  handle('tasks:complete', (id) => taskQueries.completeTask(id))
  handle('tasks:delete', (id) => taskQueries.deleteTask(id))
  handle('tasks:hard-delete', (id) => taskQueries.hardDeleteTask(id))
  handle('tasks:uncomplete', (id) => taskQueries.uncompleteTask(id))

  // Wishlist
  handle('wishlist:list', () => wishlistQueries.listWishlistItems())
  handle('wishlist:create', (input) => wishlistQueries.createWishlistItem(input))
  handle('wishlist:update', (id, input) => wishlistQueries.updateWishlistItem(id, input))
  handle('wishlist:complete', (id) => wishlistQueries.completeWishlistItem(id))
  handle('wishlist:uncomplete', (id) => wishlistQueries.uncompleteWishlistItem(id))
  handle('wishlist:delete', (id) => wishlistQueries.deleteWishlistItem(id))
  handle('wishlist:hard-delete', (id) => wishlistQueries.hardDeleteWishlistItem(id))

  // Projects
  handle('projects:list', () => projectQueries.listProjects())
  handle('projects:create', (input) => projectQueries.createProject(input))
  handle('projects:update', (id, input) => projectQueries.updateProject(id, input))
  handle('projects:reorder', (ids) => projectQueries.reorderProjects(ids))
  handle('projects:delete', (id) => projectQueries.deleteProject(id))

  // Payment Projects
  handle('paymentProjects:list', () => paymentQueries.listPaymentProjects())
  handle('paymentProjects:create', (input) => paymentQueries.createPaymentProject(input))
  handle('paymentProjects:import', (projectIds) => paymentQueries.importPaymentProjects(projectIds))
  handle('paymentProjects:update', (id, input) => paymentQueries.updatePaymentProject(id, input))
  handle('paymentProjects:delete', (id) => paymentQueries.deletePaymentProject(id))

  // Payment Milestones
  handle('paymentMilestones:list', () => paymentQueries.listPaymentMilestones())
  handle('paymentMilestones:create', (paymentProjectId, input) => paymentQueries.createPaymentMilestone(paymentProjectId, input))
  handle('paymentMilestones:update', (id, input) => paymentQueries.updatePaymentMilestone(id, input))
  handle('paymentMilestones:delete', (id) => paymentQueries.deletePaymentMilestone(id))
  handle('paymentMilestones:togglePaid', (id) => paymentQueries.togglePaymentMilestonePaid(id))

  // Payment Records
  handle('paymentRecords:list', () => paymentQueries.listPaymentRecords())
  handle('paymentRecords:create', (paymentProjectId, input) => paymentQueries.createPaymentRecord(paymentProjectId, input))
  handle('paymentRecords:delete', (id) => paymentQueries.deletePaymentRecord(id))

  // Goals
  handle('goals:list', () => goalQueries.listGoals())
  handle('goals:create', (input) => goalQueries.createGoal(input))
  handle('goals:update', (id, input) => goalQueries.updateGoal(id, input))
  handle('goals:complete', (id) => goalQueries.completeGoal(id))
  handle('goals:delete', (id) => goalQueries.deleteGoal(id))

  // Settings
  handle('settings:getAll', () => settingQueries.getAllSettings())
  handle('settings:set', (key, value) => settingQueries.setSetting(key, value))

  // Reports
  handle('reports:get', (month) => reportQueries.getReport(month))
  handle('reports:generate', async (month) => {
    const apiKey = settingQueries.getSetting('openai_api_key') ?? ''
    return reportQueries.generateReport(month, apiKey)
  })
  handle('reports:testOpenAiKey', async (apiKey: string) => {
    try {
      const { default: OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey })
      await client.models.list()
      return { ok: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg }
    }
  })

  // Quotes
  handle('quotes:list', () => quoteQueries.listQuotes())
  handle('quotes:create', (input) => quoteQueries.createQuote(input))
  handle('quotes:update', (id, input) => quoteQueries.updateQuote(id, input))
  handle('quotes:delete', (id) => quoteQueries.deleteQuote(id))
  handle('quotes:toggleHidden', (id) => quoteQueries.toggleQuoteHidden(id))

  // Quit app
  handle('app:quit', () => app.quit())

  // Test notification
  handle('notifications:test', () => {
    new Notification({
      title: 'Habit Tracker',
      body: 'Notifications are working. Now get to work.',
    }).show()
  })

  // Window controls
  handle('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
  handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    win?.isMaximized() ? win?.unmaximize() : win?.maximize()
  })
  handle('window:isMaximized', () => BrowserWindow.getFocusedWindow()?.isMaximized() ?? false)
  handle('window:close', () => BrowserWindow.getFocusedWindow()?.close())

  // App utilities
  handle('app:version', () => app.getVersion())
  handle('app:dbPath', () => getDbPath())
  handle('app:exportData', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export Habit Tracker Data',
      defaultPath: `habit-tracker-export-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return

    const data = {
      exportedAt: new Date().toISOString(),
      habits: habitQueries.listHabits(),
      tasks: taskQueries.listTasks(),
      projects: projectQueries.listProjects(),
      goals: goalQueries.listGoals(),
      settings: settingQueries.getAllSettings(),
      quotes: quoteQueries.listQuotes().filter((q) => !q.bundled),
    }
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
  })
}
