'use client'
import React, { useEffect } from 'react'
import { motion } from 'framer-motion'

interface ConfirmDeleteModalProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDeleteModal({ title, message, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        style={{
          backgroundColor: '#1E1033',
          border: '1px solid #EC4899',
          borderRadius: 12,
          padding: '24px 28px',
          width: 320,
          boxShadow: '0 0 30px rgba(109, 40, 217, 0.3)',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#F3F0FF' }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#A89EC9' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: '1px solid #4B3F72',
              background: 'transparent',
              color: '#A89EC9',
              fontSize: 14,
              cursor: 'pointer',
              transition: 'border-color 150ms, color 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#7C3AED'
              e.currentTarget.style.color = '#F3F0FF'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#4B3F72'
              e.currentTarget.style.color = '#A89EC9'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#EC4899',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  )
}
