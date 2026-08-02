import { app, BrowserWindow, globalShortcut, protocol, net } from 'electron'
import { pathToFileURL } from 'url'

let isQuitting = false
import path from 'path'
import { initDb } from './db/client'
import { registerAllHandlers } from './ipc/handlers'
import { createTray, destroyTray } from './tray'
import { startNotificationScheduler, stopNotificationScheduler } from './notifications'
import { syncAutoLaunch } from './autoLaunch'
import { getSetting } from './db/queries/settings'
import { getReport, generateReport } from './db/queries/reports'
import { format, subMonths } from 'date-fns'
import { isWithinGracePeriod } from '../shared/backfillLogic'
import { SETTING_KEYS } from '../shared/types'

const isDev = !app.isPackaged

// ---- Single-instance lock ----
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

// Register custom scheme BEFORE app is ready — must happen at module load time.
// This makes app:// behave like https:// so fetch(), absolute paths, and
// client-side navigation all resolve correctly in the renderer.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
])

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#150B1F',
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for preload to use require
    },
  })

  const url = isDev ? 'http://localhost:3000' : 'app://localhost/'

  mainWindow.loadURL(url)

  // Show window when ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    const startMinimized = getSetting('start_minimized') === 'true'
    if (!startMinimized) {
      mainWindow!.show()
      mainWindow!.focus()
    }
  })

  mainWindow.on('maximize', () => {
    mainWindow!.webContents.send('window:maximized')
  })
  mainWindow.on('unmaximize', () => {
    mainWindow!.webContents.send('window:unmaximized')
  })

  mainWindow.on('close', (event) => {
    const closeToTray = getSetting('close_to_tray') !== 'false' // default true
    if (closeToTray && !isQuitting) {
      event.preventDefault()
      mainWindow!.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

function registerGlobalShortcuts() {
  // Ctrl+Q: force quit (bypasses close-to-tray)
  globalShortcut.register('CommandOrControl+Q', () => {
    isQuitting = true
    app.quit()
  })
}

async function checkAndGenerateMonthlyReport() {
  // Run on every launch: generate last month's report if it doesn't exist
  const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM')
  const existing = getReport(lastMonth)
  if (!existing) {
    const backfillEnabled = getSetting(SETTING_KEYS.BACKFILL_HABITS) === 'true'
    if (backfillEnabled && isWithinGracePeriod(lastMonth)) {
      // Still inside the backfill grace window — retry on the next launch.
      return
    }
    try {
      const apiKey = getSetting('claude_api_key') ?? ''
      const report = await generateReport(lastMonth, apiKey)
      // Notify renderer if it's ready
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('report:ready', lastMonth)
      }
    } catch (err) {
      console.error('Failed to auto-generate monthly report:', err)
    }
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  // In production, serve the Next.js static export via the custom app:// protocol.
  // This means ALL paths (/_next/static/..., fetch requests for route data, etc.)
  // resolve correctly relative to app://localhost/ instead of breaking on file://.
  if (!isDev) {
    const outPath = path.join(process.resourcesPath, 'out')
    protocol.handle('app', (request) => {
      const { pathname } = new URL(request.url)
      const decoded = decodeURIComponent(pathname)
      let filePath = path.join(outPath, decoded)
      // Serve index.html for extensionless paths (SPA-style routes like /tasks/)
      if (!path.extname(filePath)) {
        filePath = path.join(filePath, 'index.html')
      }
      return net.fetch(pathToFileURL(filePath).toString())
    })
  }

  // Init database first — everything depends on it
  initDb()

  // Register IPC before creating window
  registerAllHandlers()

  createWindow()
  createTray(mainWindow!)
  registerGlobalShortcuts()
  startNotificationScheduler()

  await syncAutoLaunch()
  await checkAndGenerateMonthlyReport()
})

app.on('window-all-closed', () => {
  // On macOS, keep the app running even with no windows
  if (process.platform !== 'darwin') {
    const closeToTray = getSetting('close_to_tray') !== 'false'
    if (!closeToTray) app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  } else {
    mainWindow.show()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  stopNotificationScheduler()
  destroyTray()
  globalShortcut.unregisterAll()
})
