'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { LogOut, LayoutDashboard, ChefHat, Receipt, Wallet } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { navByRole, type Role } from '@/lib/nav-config'
import { useCurrentUser } from '@/lib/api/auth'
import { cn } from '@/lib/utils'

// Admin accounts can also work as kitchen, waiter, or cashier (the backend
// already grants admin every one of their permissions) — this lets them
// jump between the four areas without logging out.
const ACCOUNT_VIEWS: { role: Role; label: string; href: string; icon: typeof LayoutDashboard }[] = [
  { role: 'admin', label: 'Admin', href: '/admin', icon: LayoutDashboard },
  { role: 'kitchen', label: 'Kitchen', href: '/kitchen/orders', icon: ChefHat },
  { role: 'waiter', label: 'Waiter', href: '/waiter/orders/new', icon: Receipt },
  { role: 'cashier', label: 'Cashier', href: '/cashier/queue', icon: Wallet },
]

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: user, isLoading: userLoading } = useCurrentUser()
  const permissions = user?.role.permissions ?? []
  // Same OR logic as requirePermission server-side: an item with no
  // `permissions` list is always shown (shell roots), otherwise it needs at
  // least one of the listed keys — so a custom role only sees links to
  // pages it can actually use, not the built-in role's full default set.
  const items = navByRole[role].filter((item) => !item.permissions || item.permissions.some((p) => permissions.includes(p)))

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    queryClient.clear()
    router.push('/login')
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center justify-center rounded-md border border-border bg-sidebar-accent/60 px-2 py-2.5 shadow-sm">
          <Image
            src="/itec_restaurant_logo.png"
            alt="ITEC Restaurant Management System"
            width={220}
            height={78}
            className="h-auto w-full max-w-[220px] object-contain"
            priority
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {user?.role.homeArea === 'admin' && (
          <div className="px-3 pt-3">
            <div className="grid grid-cols-2 gap-1 rounded-md border border-sidebar-border bg-primary-foreground/10 p-1">
              {ACCOUNT_VIEWS.map((view) => {
                const isActiveView = role === view.role
                return (
                  <Link
                    key={view.role}
                    href={view.href}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors',
                      isActiveView
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                        : 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground'
                    )}
                  >
                    <view.icon className="h-3.5 w-3.5" />
                    {view.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold capitalize text-white">{role} menu</SidebarGroupLabel>
          <SidebarGroupContent>
            {!userLoading && items.length === 0 && (
              <p className="px-2 py-2 text-xs leading-relaxed text-primary-foreground/80">
                Your role has no permissions granted yet — ask an admin to update it.
              </p>
            )}
            <SidebarMenu>
              {items.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.url} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3">
        <div className="flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-2 shadow-sm">
          <span className="text-sm font-medium text-foreground">{user?.name ?? '…'}</span>
          <button
            onClick={handleLogout}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}