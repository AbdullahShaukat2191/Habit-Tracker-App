'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function BootAnimation() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2200)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="boot"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: '#150B1F',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '0.12em',
                lineHeight: 1,
              }}
            >
              HT
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                fontWeight: 500,
                color: '#B8A8C8',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Habit Tracker
            </div>
            {/* Pink accent underline */}
            <div
              style={{
                marginTop: 10,
                height: 2,
                width: 40,
                borderRadius: 2,
                backgroundColor: '#E879B9',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            />
          </div>

          {/* Loading bar */}
          <div
            style={{
              width: 200,
              height: 3,
              borderRadius: 2,
              backgroundColor: '#2A1838',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.8, ease: [0.4, 0, 0.2, 1] }}
              style={{
                height: '100%',
                borderRadius: 2,
                backgroundColor: '#E879B9',
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
