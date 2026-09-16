import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

export const getTables = () => apiFetch<string[]>('/api/tables')

export function useTables() {
  return useQuery({ queryKey: ['tables'], queryFn: getTables })
}
