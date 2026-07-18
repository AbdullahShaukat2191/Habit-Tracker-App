import { app, Menu, Tray, BrowserWindow, nativeImage } from 'electron'
import path from 'path'
import { pauseNotifications, resumeNotifications } from './notifications'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow) {
  // Fallback to a blank icon if custom icon not built yet
  const iconPath = path.join(
    app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'),
    'buildResources',
    'icon.png'
  )

  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty()
    }
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Habit Tracker')

  buildContextMenu(mainWindow)

  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}

function buildContextMenu(mainWindow: BrowserWindow) {
  if (!tray) return
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Habit Tracker',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      },
    },
    { type: 'separator' },
    {
      label: 'Pause Notifications for 1 hour',
      click: () => pauseNotifications(60 * 60 * 1000),
    },
    {
      label: 'Pause Notifications for today',
      click: () => {
        const now = new Date()
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        pauseNotifications(endOfDay.getTime() - now.getTime())
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
}

export function destroyTray() {
  tray?.destroy()
  tray = null
}
