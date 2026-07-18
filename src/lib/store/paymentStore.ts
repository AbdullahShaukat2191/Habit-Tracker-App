'use client'
import { create } from 'zustand'
import type {
  PaymentProject, PaymentMilestone, PaymentRecord,
  CreatePaymentProjectInput, UpdatePaymentProjectInput,
  CreatePaymentMilestoneInput, UpdatePaymentMilestoneInput,
  CreatePaymentRecordInput,
} from '../../../shared/types'
import * as ipc from '../ipc'

interface PaymentStore {
  paymentProjects: PaymentProject[]
  paymentMilestones: PaymentMilestone[]
  paymentRecords: PaymentRecord[]
  loading: boolean
  error: string | null

  loadAll: () => Promise<void>

  createPaymentProject: (input: CreatePaymentProjectInput) => Promise<PaymentProject>
  importPaymentProjects: (projectIds: string[]) => Promise<void>
  updatePaymentProject: (id: string, input: UpdatePaymentProjectInput) => Promise<void>
  deletePaymentProject: (id: string) => Promise<void>

  createPaymentMilestone: (paymentProjectId: string, input: CreatePaymentMilestoneInput) => Promise<void>
  updatePaymentMilestone: (id: string, input: UpdatePaymentMilestoneInput) => Promise<void>
  deletePaymentMilestone: (id: string) => Promise<void>
  togglePaymentMilestonePaid: (id: string) => Promise<void>

  createPaymentRecord: (paymentProjectId: string, input: CreatePaymentRecordInput) => Promise<void>
  deletePaymentRecord: (id: string) => Promise<void>
}

export const usePaymentStore = create<PaymentStore>((set) => ({
  paymentProjects: [],
  paymentMilestones: [],
  paymentRecords: [],
  loading: false,
  error: null,

  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const [paymentProjects, paymentMilestones, paymentRecords] = await Promise.all([
        ipc.listPaymentProjects(),
        ipc.listPaymentMilestones(),
        ipc.listPaymentRecords(),
      ])
      set({ paymentProjects, paymentMilestones, paymentRecords, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createPaymentProject: async (input) => {
    const project = await ipc.createPaymentProject(input)
    set((s) => ({ paymentProjects: [...s.paymentProjects, project] }))
    return project
  },

  importPaymentProjects: async (projectIds) => {
    const imported = await ipc.importPaymentProjects(projectIds)
    set((s) => ({ paymentProjects: [...s.paymentProjects, ...imported] }))
  },

  updatePaymentProject: async (id, input) => {
    const updated = await ipc.updatePaymentProject(id, input)
    set((s) => ({ paymentProjects: s.paymentProjects.map((p) => (p.id === id ? updated : p)) }))
  },

  deletePaymentProject: async (id) => {
    await ipc.deletePaymentProject(id)
    set((s) => ({
      paymentProjects: s.paymentProjects.filter((p) => p.id !== id),
      paymentMilestones: s.paymentMilestones.filter((m) => m.paymentProjectId !== id),
      paymentRecords: s.paymentRecords.filter((r) => r.paymentProjectId !== id),
    }))
  },

  createPaymentMilestone: async (paymentProjectId, input) => {
    const milestone = await ipc.createPaymentMilestone(paymentProjectId, input)
    set((s) => ({ paymentMilestones: [...s.paymentMilestones, milestone] }))
  },

  updatePaymentMilestone: async (id, input) => {
    const updated = await ipc.updatePaymentMilestone(id, input)
    set((s) => ({ paymentMilestones: s.paymentMilestones.map((m) => (m.id === id ? updated : m)) }))
  },

  deletePaymentMilestone: async (id) => {
    await ipc.deletePaymentMilestone(id)
    set((s) => ({
      paymentMilestones: s.paymentMilestones.filter((m) => m.id !== id),
      paymentRecords: s.paymentRecords.filter((r) => r.milestoneId !== id),
    }))
  },

  togglePaymentMilestonePaid: async (id) => {
    const updated = await ipc.togglePaymentMilestonePaid(id)
    set((s) => ({ paymentMilestones: s.paymentMilestones.map((m) => (m.id === id ? updated : m)) }))
    const paymentRecords = await ipc.listPaymentRecords()
    set({ paymentRecords })
  },

  createPaymentRecord: async (paymentProjectId, input) => {
    const record = await ipc.createPaymentRecord(paymentProjectId, input)
    set((s) => ({ paymentRecords: [...s.paymentRecords, record] }))
  },

  deletePaymentRecord: async (id) => {
    await ipc.deletePaymentRecord(id)
    set((s) => ({ paymentRecords: s.paymentRecords.filter((r) => r.id !== id) }))
  },
}))
