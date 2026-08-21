'use client'
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import * as ipc from '@/lib/ipc'

const DISMISS_MS = 2500

export function ZoomIndicator() {
  const [percent, setPercent] = useState<number | null>(null)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return

    const handleChange = (p: number) => {
      setPercent(p)
      setVisible(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setVisible(false), DISMISS_MS)
    }

    ipc.onZoomChanged(handleChange)
    return () => {
      ipc.removeZoomChangedListener()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Nothing has changed zoom yet this session — stay unmounted rather than show 100%.
  if (percent === null) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 56,
        right: 16,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              borderRadius: 999,
              backgroundColor: 'var(--sidebar-to)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            }}
          >
            <span style={{ color: '#A78BFA', fontWeight: 600, fontSize: 13, minWidth: 36 }}>
              {percent}%
            </span>
            <button onClick={() => ipc.zoomOut().catch(() => {})} aria-label="Zoom out" style={iconButtonStyle}>
              <Minus size={14} />
            </button>
            <button onClick={() => ipc.zoomIn().catch(() => {})} aria-label="Zoom in" style={iconButtonStyle}>
              <Plus size={14} />
            </button>
            <button onClick={() => ipc.zoomReset().catch(() => {})} style={resetButtonStyle}>
              Reset
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const iconButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--sidebar-text)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  padding: 4,
}

const resetButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'none',
  color: '#A78BFA',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
}
