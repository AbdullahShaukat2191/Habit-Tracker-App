'use client'
import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Quote } from '@shared/types'
import { allTasksConfetti } from '@/lib/confetti'

interface AllTasksDoneDialogProps {
  quote: Quote | null
  onClose: () => void
}

export function AllTasksDoneDialog({ quote, onClose }: AllTasksDoneDialogProps) {
  // Fire confetti on mount
  useEffect(() => {
    allTasksConfetti()
  }, [])

  // Close on Escape
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
        aria-labelledby="all-done-title"
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
          maxWidth: 560,
          width: '90vw',
          textAlign: 'center',
          boxSizing: 'border-box',
          cursor: 'default',
        }}
      >
        {/* Title */}
        <h1
          id="all-done-title"
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          All tasks done.
        </h1>

        {/* Subtitle */}
        <p
          style={{
            margin: 0,
            marginBottom: 40,
            fontSize: 16,
            color: 'var(--text-tertiary)',
          }}
        >
          Tomorrow you do it again.
        </p>

        {/* Quote */}
        {quote && (
          <div>
            <p
              style={{
                margin: 0,
                marginBottom: 12,
                fontSize: 16,
                fontStyle: 'italic',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              &ldquo;{quote.text}&rdquo;
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: 'var(--text-tertiary)',
              }}
            >
              &mdash; {quote.author}
            </p>
          </div>
        )}

        {/* Click anywhere hint */}
        <p
          style={{
            margin: '32px 0 0',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            opacity: 0.6,
          }}
        >
          Click anywhere to close
        </p>
      </motion.div>
    </div>
  )
}
