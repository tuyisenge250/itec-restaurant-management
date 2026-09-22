import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

export type HomeArea = 'admin' | 'kitchen' | 'waiter' | 'cashier'

export type CurrentUser = {
  id: string
  name: string
  role: {
    id: string
    name: string
    homeArea: HomeArea
    permissions: string[]
    maxDiscountPercent: number
  }
}

export const getMe = () => apiFetch<CurrentUser>('/api/auth/me')

export function useCurrentUser() {
  return useQuery({ queryKey: ['me'], queryFn: getMe, retry: false })
}
