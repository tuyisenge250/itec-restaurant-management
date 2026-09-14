import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

export type CurrentUser = { id: string; name: string; role: 'admin' | 'kitchen' | 'waiter' }

export const getMe = () => apiFetch<CurrentUser>('/api/auth/me')

export function useCurrentUser() {
  return useQuery({ queryKey: ['me'], queryFn: getMe, retry: false })
}
