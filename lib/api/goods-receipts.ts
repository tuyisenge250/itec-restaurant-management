import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { recordGoodsReturnSchema } from '@/lib/validation/goods-receipt.schema'

export type GoodsReturn = {
  id: string
  quantityReturned: number
  reason: string
  returnedAt: string
  returnedBy: { name: string }
}

export type GoodsReceiptLine = {
  id: string
  quantityReceived: number
  unitCost: number
  costingMethod: 'fifo' | 'lifo'
  purchaseOrderItem: { inventoryItem: { name: string; unit: string } }
  returns: GoodsReturn[]
}

export type GoodsReceipt = {
  id: string
  grnNumber: number
  receivedAt: string
  notes: string | null
  receivedBy: { name: string }
  purchaseOrder: { id: string; poNumber: number; supplier: { name: string } }
  lines: GoodsReceiptLine[]
}

export type RecordGoodsReturnInput = z.infer<typeof recordGoodsReturnSchema>

export const getGoodsReceipts = () => apiFetch<GoodsReceipt[]>('/api/goods-receipts')
export const recordGoodsReturn = (lineId: string, data: RecordGoodsReturnInput) =>
  apiFetch<GoodsReturn>(`/api/goods-receipts/lines/${lineId}/return`, { method: 'POST', body: JSON.stringify(data) })

export function useGoodsReceipts() {
  return useQuery({ queryKey: ['goods-receipts'], queryFn: getGoodsReceipts })
}
export function useRecordGoodsReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ lineId, data }: { lineId: string; data: RecordGoodsReturnInput }) => recordGoodsReturn(lineId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Return recorded — stock updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
