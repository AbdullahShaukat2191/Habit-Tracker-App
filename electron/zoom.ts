import type { BrowserWindow } from 'electron'

// Single source of truth for zoom mutation, shared by the keyboard handler in
// main.ts and the zoom:in/out/reset IPC handlers so the popup's buttons and
// the keyboard shortcuts always go through the exact same logic.
let win: BrowserWindow | null = null
const ZOOM_STEP = 0.5

export function initZoom(mainWindow: BrowserWindow) {
  win = mainWindow
}

export function getZoomPercent(): number {
  if (!win || win.isDestroyed()) return 100
  return Math.round(win.webContents.getZoomFactor() * 100)
}

function emitChange() {
  if (!win || win.isDestroyed()) return
  win.webContents.send('zoom:changed', getZoomPercent())
}

export function zoomIn() {
  if (!win || win.isDestroyed()) return
  win.webContents.setZoomLevel(win.webContents.getZoomLevel() + ZOOM_STEP)
  emitChange()
}

export function zoomOut() {
  if (!win || win.isDestroyed()) return
  win.webContents.setZoomLevel(win.webContents.getZoomLevel() - ZOOM_STEP)
  emitChange()
}

export function zoomReset() {
  if (!win || win.isDestroyed()) return
  win.webContents.setZoomLevel(0)
  emitChange()
}
