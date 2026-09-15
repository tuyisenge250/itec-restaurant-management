'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { retry: 1, staleTime: 30_000 },
        mutations: { onError: () => {} },
      },
    })
  )
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
