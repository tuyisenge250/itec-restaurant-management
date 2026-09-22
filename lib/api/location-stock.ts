import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import { adjustLocationStockSchema } from '@/lib/validation/stock-requisition.schema'

export type LocationStockProjection = { id: string; name: string; unit: string; main: number; kitchen: number; bar: number }
export type AdjustLocationStockInput = z.infer<typeof adjustLocationStockSchema>

export const getLocationStockProjection = () => apiFetch<LocationStockProjection[]>('/api/location-stock')
export const adjustLocationStock = (data: AdjustLocationStockInput) =>
  apiFetch<void>('/api/location-stock/adjust', { method: 'POST', body: JSON.stringify(data) })

export function useLocationStockProjection() {
  return useQuery({ queryKey: ['location-stock'], queryFn: getLocationStockProjection })
}
export function useAdjustLocationStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adjustLocationStock,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['location-stock'] }); toast.success('Stock adjusted') },
    onError: (e: Error) => toast.error(e.message),
  })
}
