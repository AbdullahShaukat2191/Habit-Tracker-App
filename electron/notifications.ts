import { Notification } from 'electron'
import { getSetting } from './db/queries/settings'
import { getRandomVisibleQuote } from './db/queries/quotes'
import { listHabits, getHabitCompletions } from './db/queries/habits'
import { listTasks } from './db/queries/tasks'
import { listGoals } from './db/queries/goals'
import { format } from 'date-fns'

let schedulerInterval: ReturnType<typeof setInterval> | null = null
let nextFireTime = 0
let pauseUntil = 0 // epoch ms; 0 = not paused

function isWithinActiveHours(): boolean {
  const start = getSetting('notify_active_start') ?? '09:00'
  const end = getSetting('notify_active_end') ?? '22:00'
  const now = new Date()
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  return nowMins >= startMins && nowMins < endMins
}

function pickNextDelayMs(): number {
  const minHours = parseFloat(getSetting('notify_min_hours') ?? '1')
  const maxHours = parseFloat(getSetting('notify_max_hours') ?? '2')
  const minMs = minHours * 60 * 60 * 1000
  const maxMs = maxHours * 60 * 60 * 1000
  return minMs + Math.random() * (maxMs - minMs)
}

function checkAndNotify() {
  if (Date.now() < pauseUntil) return
  if (getSetting('notifications_enabled') !== 'true') return
  if (!isWithinActiveHours()) return
  if (Date.now() < nextFireTime) return

  const quote = getRandomVisibleQuote()
  if (!quote) return

  const today = format(new Date(), 'yyyy-MM-dd')
  const notifyHabits = getSetting('notify_habits') === 'true'
  const notifyTasks = getSetting('notify_tasks') === 'true'
  const notifyGoals = getSetting('notify_goals') === 'true'

  // Build candidate pool with weights
  const candidates: Array<{ title: string; section: string }> = []

  if (notifyTasks) {
    const incompleteTasks = listTasks().filter((t) => !t.completedAt)
    incompleteTasks.forEach((t) => {
      // Weight tasks higher — add 3 entries each
      for (let i = 0; i < 3; i++) candidates.push({ title: t.title, section: 'tasks' })
    })
  }

  if (notifyHabits) {
    const currentMonth = format(new Date(), 'yyyy-MM')
    const completions = getHabitCompletions(currentMonth)
    const completedToday = new Set(completions.filter((c) => c.date === today).map((c) => c.habitId))
    const incompleteHabits = listHabits().filter((h) => !completedToday.has(h.id))
    incompleteHabits.forEach((h) => {
      // Weight habits at 1.5x tasks... simplified to 1.5 entries (round to 2)
      for (let i = 0; i < 2; i++) candidates.push({ title: h.name, section: 'habits' })
    })
  }

  if (notifyGoals) {
    const incompleteGoals = listGoals().filter((g) => !g.completedAt)
    incompleteGoals.forEach((g) => candidates.push({ title: g.title, section: 'goals' }))
  }

  if (candidates.length === 0) return

  const pick = candidates[Math.floor(Math.random() * candidates.length)]

  new Notification({
    title: pick.title,
    body: quote.text,
    silent: false,
  }).show()

  nextFireTime = Date.now() + pickNextDelayMs()
}

export function startNotificationScheduler() {
  if (schedulerInterval) return
  nextFireTime = Date.now() + pickNextDelayMs()
  schedulerInterval = setInterval(checkAndNotify, 30_000)
}

export function stopNotificationScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
}

export function pauseNotifications(durationMs: number) {
  pauseUntil = Date.now() + durationMs
}

export function resumeNotifications() {
  pauseUntil = 0
}
