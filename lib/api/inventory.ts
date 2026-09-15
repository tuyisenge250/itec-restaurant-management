import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { logWasteSchema, adjustStockSchema } from '@/lib/validation/inventory.schema'

export type InventoryItem = {
  id: string
  name: string
  unit: string
  itemType: 'raw' | 'prepared'
  currentStock: number
  reorderLevel: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  stockValue: number
}
export type CreateInventoryInput = { name: string; unit: string; reorderLevel?: number }
export type LogWasteInput = z.infer<typeof logWasteSchema>
export type AdjustStockInput = z.infer<typeof adjustStockSchema>
export type InventoryLot = {
  id: string
  inventoryItemId: string
  supplierId: string | null
  supplier: { name: string } | null
  costingMethod: 'fifo' | 'lifo'
  unitCost: number
  quantityReceived: number
  quantityRemaining: number
  receivedAt: string
  notes: string | null
}
export type InventoryTransaction = {
  id: string
  inventoryItemId: string
  lotId: string
  type: 'receipt' | 'consumption' | 'waste' | 'adjustment'
  source: 'purchase_order' | 'sale' | 'prep_production' | 'waste' | 'manual_adjustment'
  quantity: number
  unitCost: number
  referenceId: string | null
  reasonCode: string | null
  notes: string | null
  createdAt: string
  recordedBy: { name: string }
}
export type WasteLogEntry = InventoryTransaction & { inventoryItem: { name: string; unit: string } }

export const getInventory = () => apiFetch<InventoryItem[]>('/api/inventory')
export const getInventoryLots = (itemId: string) => apiFetch<InventoryLot[]>(`/api/inventory/${itemId}/lots`)
export const getInventoryTransactions = (itemId: string, params?: { type?: string; from?: string; to?: string }) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return apiFetch<InventoryTransaction[]>(`/api/inventory/${itemId}/transactions${qs ? `?${qs}` : ''}`)
}
export const getWasteLog = () => apiFetch<WasteLogEntry[]>('/api/inventory/waste')
export const createInventoryItem = (data: CreateInventoryInput) =>
  apiFetch<InventoryItem>('/api/inventory', { method: 'POST', body: JSON.stringify(data) })
export const logWaste = (data: LogWasteInput) =>
  apiFetch<void>('/api/inventory/waste', { method: 'POST', body: JSON.stringify(data) })
export const adjustStock = (data: AdjustStockInput) =>
  apiFetch<void>('/api/inventory/adjust', { method: 'POST', body: JSON.stringify(data) })
export const updateInventoryItem = (id: string, data: Partial<CreateInventoryInput>) =>
  apiFetch<InventoryItem>(`/api/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteInventoryItem = (id: string) =>
  apiFetch<void>(`/api/inventory/${id}`, { method: 'DELETE' })

export function useInventory() {
  return useQuery({ queryKey: ['inventory'], queryFn: getInventory })
}
export function useInventoryLots(itemId: string | undefined) {
  return useQuery({
    queryKey: ['inventory', itemId, 'lots'],
    queryFn: () => getInventoryLots(itemId!),
    enabled: !!itemId,
  })
}
export function useInventoryTransactions(itemId: string | undefined, params?: { type?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ['inventory', itemId, 'transactions', params],
    queryFn: () => getInventoryTransactions(itemId!, params),
    enabled: !!itemId,
  })
}
export function useWasteLog() {
  return useQuery({ queryKey: ['inventory', 'waste-log'], queryFn: getWasteLog })
}
export function useCreateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item created') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateInventoryInput> }) => updateInventoryItem(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item updated') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useLogWaste() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: logWaste,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Waste logged') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adjustStock,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Stock adjusted') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useDeleteInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item deleted') },
    onError: (e: Error) => toast.error(e.message),
  })
}
