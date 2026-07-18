'use client'
import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { allTasksConfetti } from '@/lib/confetti'

interface PerfectDayDialogProps {
  onClose: () => void
}

export function PerfectDayDialog({ onClose }: PerfectDayDialogProps) {
  useEffect(() => {
    allTasksConfetti()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)',
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          padding: 48,
          maxWidth: 520,
          width: '90vw',
          textAlign: 'center',
          boxSizing: 'border-box',
          cursor: 'default',
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 12, lineHeight: 1 }}>🔥</div>
        <h1
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          Perfect Day.
        </h1>
        <p
          style={{
            margin: 0,
            marginBottom: 0,
            fontSize: 16,
            color: 'var(--text-tertiary)',
          }}
        >
          Every habit done. That&apos;s how it&apos;s done.
        </p>
        <p
          style={{
            margin: '32px 0 0',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            opacity: 0.5,
          }}
        >
          Click anywhere to close
        </p>
      </motion.div>
    </div>
  )
}
