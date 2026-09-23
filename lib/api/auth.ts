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
  // Drives permission-gated nav/actions — the whole point of "instant"
  // permission changes falls apart if the client trusts a stale cached
  // role. staleTime: 0 overrides the app-wide 30s default so this always
  // refetches on mount and on window refocus instead of serving cache.
  return useQuery({ queryKey: ['me'], queryFn: getMe, retry: false, staleTime: 0 })
}
