import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { toast } from 'sonner'
import type { z } from 'zod'
import {
  createExpenseCategorySchema, updateExpenseCategorySchema,
  createExpenseSchema, updateExpenseSchema,
} from '@/lib/validation/expense.schema'

export type ExpenseCategory = { id: string; name: string; isActive: boolean }
export type Expense = {
  id: string; categoryId: string; amount: number; expenseDate: string
  description: string | null; isRecurring: boolean; recordedById: string
  isDeleted: boolean; createdAt: string
  category: { name: string }
  recordedBy: { name: string }
}
export type ExpenseList = { entries: Expense[]; total: number; page: number; pageSize: number }
export type ExpenseFilters = { from?: string; to?: string; categoryId?: string; isRecurring?: boolean; page?: number }

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>

export const getExpenseCategories = (isActive?: boolean) =>
  apiFetch<ExpenseCategory[]>(`/api/expense-categories${isActive !== undefined ? `?isActive=${isActive}` : ''}`)
export const createExpenseCategory = (data: CreateExpenseCategoryInput) =>
  apiFetch<ExpenseCategory>('/api/expense-categories', { method: 'POST', body: JSON.stringify(data) })
export const updateExpenseCategory = (id: string, data: UpdateExpenseCategoryInput) =>
  apiFetch<ExpenseCategory>(`/api/expense-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const getExpenses = (filters?: ExpenseFilters) => {
  const qs = new URLSearchParams(
    Object.entries(filters ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString()
  return apiFetch<ExpenseList>(`/api/expenses${qs ? `?${qs}` : ''}`)
}
export const createExpense = (data: CreateExpenseInput) =>
  apiFetch<Expense>('/api/expenses', { method: 'POST', body: JSON.stringify(data) })
export const updateExpense = (id: string, data: UpdateExpenseInput) =>
  apiFetch<Expense>(`/api/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteExpense = (id: string) =>
  apiFetch<void>(`/api/expenses/${id}`, { method: 'DELETE' })

export function useExpenseCategories(isActive?: boolean) {
  return useQuery({ queryKey: ['expense-categories', isActive], queryFn: () => getExpenseCategories(isActive) })
}
export function useCreateExpenseCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createExpenseCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-categories'] }); toast.success('Category created') },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateExpenseCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseCategoryInput }) => updateExpenseCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-categories'] }); toast.success('Category updated') },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useExpenses(filters?: ExpenseFilters) {
  return useQuery({ queryKey: ['expenses', filters], queryFn: () => getExpenses(filters) })
}
export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Expense recorded')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseInput }) => updateExpense(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Expense updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Expense deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
