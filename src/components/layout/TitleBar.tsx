'use client'
import React, { useEffect, useState } from 'react'
import * as ipc from '@/lib/ipc'

interface ElectronCSSProperties extends React.CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag'
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    ipc.isWindowMaximized().then(setIsMaximized).catch(() => {})
    ipc.onWindowMaximized(() => setIsMaximized(true))
    ipc.onWindowUnmaximized(() => setIsMaximized(false))
    return () => ipc.removeWindowMaximizeListeners()
  }, [])

  const handleMinimize = () => ipc.minimizeWindow().catch(() => {})
  const handleMaximize = () => ipc.maximizeWindow().catch(() => {})
  const handleClose = () => ipc.closeWindow().catch(() => {})

  const handleDotEnter = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.opacity = '0.65' }
  const handleDotLeave = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.opacity = '1' }

  const barStyle: ElectronCSSProperties = {
    height: 48,
    background: 'linear-gradient(90deg, #0A0418, #120820)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 16,
    flexShrink: 0,
    WebkitAppRegion: 'drag',
    userSelect: 'none',
  }

  const buttonGroupStyle: ElectronCSSProperties = {
    display: 'flex',
    gap: 8,
    WebkitAppRegion: 'no-drag',
  }

  const dotBase: React.CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'opacity 100ms',
  }

  return (
    <div style={barStyle}>
      <span style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em' }}>
        HT
      </span>
      <div style={buttonGroupStyle}>
        <button
          onClick={handleMinimize}
          aria-label="Minimize"
          style={{ ...dotBase, backgroundColor: '#3D3550' }}
          onMouseEnter={handleDotEnter}
          onMouseLeave={handleDotLeave}
        >
          <div style={{ width: 10, height: 1.5, backgroundColor: '#FFFFFF' }} />
        </button>
        <button
          onClick={handleMaximize}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          style={{ ...dotBase, backgroundColor: '#3D3550' }}
          onMouseEnter={handleDotEnter}
          onMouseLeave={handleDotLeave}
        >
          {isMaximized ? (
            /* Two overlapping squares (restore icon) */
            <div style={{ position: 'relative', width: 11, height: 11 }}>
              {/* Back square */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: 8,
                height: 8,
                border: '1.5px solid #FFFFFF',
                borderRadius: 1,
              }} />
              {/* Front square — covers part of back square */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 8,
                height: 8,
                border: '1.5px solid #FFFFFF',
                borderRadius: 1,
                backgroundColor: '#3D3550',
              }} />
            </div>
          ) : (
            /* Single hollow square (maximize icon) */
            <div style={{ width: 10, height: 10, border: '1.5px solid #FFFFFF', borderRadius: 1 }} />
          )}
        </button>
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{ ...dotBase, backgroundColor: '#5A2020', color: '#F87171', fontSize: 12, lineHeight: 1 }}
          onMouseEnter={handleDotEnter}
          onMouseLeave={handleDotLeave}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
