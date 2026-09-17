import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

export type ProfitReport = {
  summary: {
    orderCount: number; revenue: number; discountTotal: number; netRevenue: number; cogs: number
    profit: number; marginPct: number
    totalExpenses: number
    expensesByCategory: { category: string; amount: number }[]
    netProfit: number
  }
  byItem: { menuItemId: string; name: string; quantitySold: number; revenue: number; cogs: number; profit: number; marginPct: number }[]
  trend: { date: string; revenue: number; cogs: number; profit: number }[]
  waste: { transactionCount: number; totalCost: number }
  range: { from: string; to: string }
}

export type ReconciliationReport = {
  range: { from: string; to: string }
  byMethod: { method: string; amount: number; count: number }[]
}

export type MenuItemDetail = {
  menuItemId: string
  name: string
  quantitySold: number
  consumption: { inventoryItemId: string; name: string; unit: string; quantity: number; cost: number }[]
  waste: { inventoryItemId: string; name: string; unit: string; quantity: number; cost: number; transactionCount: number }[]
  range: { from: string; to: string }
}

export const getProfitReport = (from: string, to: string) =>
  apiFetch<ProfitReport>(`/api/reports/profit?from=${from}&to=${to}`)
export const getReconciliationReport = (from: string, to: string) =>
  apiFetch<ReconciliationReport>(`/api/reports/reconciliation?from=${from}&to=${to}`)
export const getMenuItemDetail = (id: string, from: string, to: string) =>
  apiFetch<MenuItemDetail>(`/api/reports/menu-items/${id}?from=${from}&to=${to}`)

export function useProfitReport(from: string, to: string) {
  return useQuery({ queryKey: ['reports', 'profit', from, to], queryFn: () => getProfitReport(from, to) })
}
export function useReconciliationReport(from: string, to: string) {
  return useQuery({
    queryKey: ['reports', 'reconciliation', from, to],
    queryFn: () => getReconciliationReport(from, to),
  })
}
export function useMenuItemDetail(id: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['reports', 'menu-item-detail', id, from, to],
    queryFn: () => getMenuItemDetail(id!, from, to),
    enabled: !!id,
  })
}
