'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

// The access-token cookie expires after 15 minutes. Silently renewing it
// every 10 minutes while the app is open means an active session basically
// never hits the reactive refresh-and-retry path in apiFetch — that path
// stays as the fallback for a tab that was idle/backgrounded past 15 min.
function useSessionKeepAlive() {
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/auth/refresh', { method: 'POST' }).catch(() => {})
    }, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { retry: 1, staleTime: 30_000 },
        mutations: { onError: () => {} },
      },
    })
  )
  useSessionKeepAlive()
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
