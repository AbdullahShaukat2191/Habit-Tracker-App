'use client'
import { create } from 'zustand'

interface ToastStore {
  message: string
  visible: boolean
  type: 'error' | 'success' | 'info'
  show: (message: string, type?: 'error' | 'success' | 'info') => void
  hide: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  message: '',
  visible: false,
  type: 'info',
  show: (message, type = 'info') => set({ message, visible: true, type }),
  hide: () => set({ visible: false }),
}))
