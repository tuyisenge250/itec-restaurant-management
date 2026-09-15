import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

export type ProfitReport = {
  summary: { orderCount: number; revenue: number; discountTotal: number; netRevenue: number; cogs: number; profit: number; marginPct: number }
  byItem: { menuItemId: string; name: string; quantitySold: number; revenue: number; cogs: number; profit: number; marginPct: number }[]
  trend: { date: string; revenue: number; cogs: number; profit: number }[]
  waste: { transactionCount: number; totalCost: number }
  range: { from: string; to: string }
}

export type ReconciliationReport = {
  range: { from: string; to: string }
  byMethod: { method: string; amount: number; refunded: number; net: number; count: number }[]
}

export const getProfitReport = (from: string, to: string) =>
  apiFetch<ProfitReport>(`/api/reports/profit?from=${from}&to=${to}`)
export const getReconciliationReport = (from: string, to: string) =>
  apiFetch<ReconciliationReport>(`/api/reports/reconciliation?from=${from}&to=${to}`)

export function useProfitReport(from: string, to: string) {
  return useQuery({ queryKey: ['reports', 'profit', from, to], queryFn: () => getProfitReport(from, to) })
}
export function useReconciliationReport(from: string, to: string) {
  return useQuery({
    queryKey: ['reports', 'reconciliation', from, to],
    queryFn: () => getReconciliationReport(from, to),
  })
}
