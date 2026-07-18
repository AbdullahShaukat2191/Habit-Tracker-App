'use client'
import React, { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Quote } from '@shared/types'

interface GoalCompletedDialogProps {
  quote: Quote | null
  onClose: () => void
}

export function GoalCompletedDialog({ quote, onClose }: GoalCompletedDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  // Focus trap + Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !modalRef.current) return
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const elements = Array.from(focusable)
      if (elements.length === 0) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-done-title"
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
          maxWidth: 540,
          width: '90vw',
          textAlign: 'center',
          boxSizing: 'border-box',
          cursor: 'default',
        }}
      >
        <h1
          id="goal-done-title"
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          A life goal complete.
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: 16,
            color: 'var(--text-tertiary)',
          }}
        >
          This is who you&apos;re becoming.
        </p>

        {quote && (
          <div style={{ marginTop: 36 }}>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                fontStyle: 'italic',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              &ldquo;{quote.text}&rdquo;
            </p>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 14,
                color: 'var(--text-tertiary)',
              }}
            >
              &mdash; {quote.author}
            </p>
          </div>
        )}

        <button
          ref={closeButtonRef}
          onClick={onClose}
          style={{
            marginTop: 36,
            padding: '10px 32px',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Continue
        </button>
      </motion.div>
    </div>
  )
}
