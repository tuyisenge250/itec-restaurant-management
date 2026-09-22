'use client'

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/lib/api/auth'

const homeAreaHome: Record<string, string> = {
  admin: '/admin',
  kitchen: '/kitchen/orders',
  waiter: '/waiter/orders',
  cashier: '/cashier/queue',
}

export default function UnauthorizedPage() {
  const { data: user } = useCurrentUser()
  const home = user ? (homeAreaHome[user.role.homeArea] ?? '/login') : '/login'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <ShieldAlert className="h-10 w-10 text-destructive" />
      <div>
        <h1 className="text-lg font-semibold text-foreground">You don&apos;t have access to this page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account role doesn&apos;t permit viewing this section.
        </p>
      </div>
      <Link href={home}>
        <Button>Back to my dashboard</Button>
      </Link>
    </div>
  )
}
