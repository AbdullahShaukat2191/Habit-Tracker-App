'use client'
import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from '@/lib/store/toastStore'
import { X } from 'lucide-react'

export function Toast() {
  const { message, visible, type, hide } = useToastStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (visible) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(hide, 3500)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible, message, hide])

  const bgColor =
    type === 'error' ? '#7F1D1D' : type === 'success' ? '#22C55E' : 'var(--bg-surface-2)'
  const borderColor =
    type === 'error' ? '#F87171' : type === 'success' ? '#4ADE80' : 'var(--border-strong)'
  const textColor =
    type === 'error' || type === 'success' ? 'white' : 'var(--text-primary)'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            role="alert"
            aria-live="polite"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 10,
              border: `1px solid ${borderColor}`,
              backgroundColor: bgColor,
              color: textColor,
              fontSize: 14,
              maxWidth: 420,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            <span style={{ flex: 1 }}>{message}</span>
            <button
              onClick={hide}
              aria-label="Dismiss notification"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
