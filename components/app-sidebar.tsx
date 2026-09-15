'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { LogOut } from 'lucide-react'
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

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const items = navByRole[role]
  const { data: user } = useCurrentUser()

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
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold capitalize text-white">{role} menu</SidebarGroupLabel>
          <SidebarGroupContent>
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