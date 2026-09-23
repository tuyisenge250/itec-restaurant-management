import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import {
  createRequisitionSchema,
  approveRequisitionSchema,
  rejectRequisitionSchema,
  receiveRequisitionSchema,
} from '@/lib/validation/stock-requisition.schema'

export type StockLocation = 'kitchen' | 'bar'
export type StockRequisitionStatus = 'pending' | 'on_hold' | 'approved' | 'rejected' | 'received' | 'cancelled'

export type StockRequisitionItem = {
  id: string
  inventoryItemId: string
  inventoryItem: { name: string; unit: string }
  quantityRequested: number
  quantityApproved: number | null
  quantityReceived: number | null
}

export type StockRequisition = {
  id: string
  location: StockLocation
  status: StockRequisitionStatus
  notes: string | null
  requestedById: string
  requestedBy: { name: string }
  reviewedById: string | null
  reviewedBy: { name: string } | null
  reviewedAt: string | null
  reviewNotes: string | null
  receivedById: string | null
  receivedBy: { name: string } | null
  receivedAt: string | null
  createdAt: string
  items: StockRequisitionItem[]
}

export type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>
export type ApproveRequisitionInput = z.infer<typeof approveRequisitionSchema>
export type RejectRequisitionInput = z.infer<typeof rejectRequisitionSchema>
export type ReceiveRequisitionInput = z.infer<typeof receiveRequisitionSchema>

export type StockRequisitionFilters = { location?: StockLocation; status?: StockRequisitionStatus }

export const getStockRequisitions = (filters?: StockRequisitionFilters) => {
  const qs = new URLSearchParams(Object.entries(filters ?? {}).filter(([, v]) => !!v) as [string, string][]).toString()
  return apiFetch<StockRequisition[]>(`/api/stock-requisitions${qs ? `?${qs}` : ''}`)
}
export const createStockRequisition = (data: CreateRequisitionInput) =>
  apiFetch<StockRequisition>('/api/stock-requisitions', { method: 'POST', body: JSON.stringify(data) })
export const approveStockRequisition = (id: string, data: ApproveRequisitionInput) =>
  apiFetch<StockRequisition>(`/api/stock-requisitions/${id}/approve`, { method: 'POST', body: JSON.stringify(data) })
export const rejectStockRequisition = (id: string, data: RejectRequisitionInput) =>
  apiFetch<StockRequisition>(`/api/stock-requisitions/${id}/reject`, { method: 'POST', body: JSON.stringify(data) })
export const cancelStockRequisition = (id: string) =>
  apiFetch<StockRequisition>(`/api/stock-requisitions/${id}/cancel`, { method: 'POST' })
export const holdStockRequisition = (id: string) =>
  apiFetch<StockRequisition>(`/api/stock-requisitions/${id}/hold`, { method: 'POST' })
export const receiveStockRequisition = (id: string, data: ReceiveRequisitionInput) =>
  apiFetch<StockRequisition>(`/api/stock-requisitions/${id}/receive`, { method: 'POST', body: JSON.stringify(data) })

export function useStockRequisitions(filters?: StockRequisitionFilters) {
  return useQuery({ queryKey: ['stock-requisitions', filters], queryFn: () => getStockRequisitions(filters) })
}
export function useCreateStockRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createStockRequisition,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-requisitions'] }); toast.success('Requisition submitted') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useApproveStockRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveRequisitionInput }) => approveStockRequisition(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requisitions'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Requisition approved — stock sent')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useRejectStockRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectRequisitionInput }) => rejectStockRequisition(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-requisitions'] }); toast.success('Requisition sent back') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useCancelStockRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelStockRequisition,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-requisitions'] }); toast.success('Requisition cancelled') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useHoldStockRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: holdStockRequisition,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-requisitions'] }),
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useReceiveStockRequisition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReceiveRequisitionInput }) => receiveStockRequisition(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-requisitions'] })
      qc.invalidateQueries({ queryKey: ['location-stock'] })
      toast.success('Receipt confirmed')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
