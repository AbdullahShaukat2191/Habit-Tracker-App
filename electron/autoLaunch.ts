import { app } from 'electron'
import { getSetting } from './db/queries/settings'

let AutoLaunch: any = null

async function getAutoLauncher() {
  if (!AutoLaunch) {
    AutoLaunch = (await import('auto-launch')).default
  }
  return new AutoLaunch({ name: 'Habit Tracker', path: app.getPath('exe') })
}

export async function syncAutoLaunch() {
  if (!app.isPackaged) return // only run in production
  const enabled = getSetting('launch_on_startup') === 'true'
  const launcher = await getAutoLauncher()
  const isEnabled = await launcher.isEnabled()
  if (enabled && !isEnabled) await launcher.enable()
  if (!enabled && isEnabled) await launcher.disable()
}
