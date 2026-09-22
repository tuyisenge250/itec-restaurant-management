'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, Loader2, ShieldCheck, ChefHat, ConciergeBell, Wallet } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

const demoUsers = [
  { label: 'Admin',   email: 'admin@demo.com',   password: 'demo1234', icon: ShieldCheck,   color: 'text-primary' },
  { label: 'Kitchen', email: 'kitchen@demo.com', password: 'demo1234', icon: ChefHat,       color: 'text-warning' },
  { label: 'Waiter',  email: 'waiter@demo.com',  password: 'demo1234', icon: ConciergeBell, color: 'text-success' },
  { label: 'Cashier', email: 'cashier@demo.com', password: 'demo1234', icon: Wallet,        color: 'text-success' },
]

const homeAreaRedirect: Record<string, string> = {
  admin:   '/admin',
  kitchen: '/kitchen/orders',
  waiter:  '/waiter/orders',
  cashier: '/cashier/queue',
}

export default function LoginPage() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const next        = searchParams.get('next')
  const emailRef    = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading]       = useState(false)
  const [error, setError]               = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const email    = emailRef.current?.value ?? ''
    const password = passwordRef.current?.value ?? ''
    if (!email || !password) { setError('Please enter email and password.'); return }
    setError('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Login failed'); return }
      router.push(next && next.startsWith('/') ? next : (homeAreaRedirect[data.homeArea] ?? '/'))
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function fillDemo(email: string, password: string) {
    if (emailRef.current)    emailRef.current.value    = email
    if (passwordRef.current) passwordRef.current.value = password
    setError('')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-6 flex flex-col items-center gap-3">
        <Image
          src="/itec_restaurant_logo.png"
          alt="ITEC Restaurant Management System"
          width={420}
          height={149}
          className="h-auto w-72 object-contain"
          priority
        />
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Log in to Restaurant OS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your credentials to continue</p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" ref={emailRef} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-10"
                ref={passwordRef}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging in…</> : 'Log in'}
          </button>
        </form>

        <div className="mt-6">
          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">demo accounts</span>
            <Separator className="flex-1" />
          </div>
          <div className="mt-3 flex gap-2">
            {demoUsers.map((u) => (
              <button
                key={u.label}
                type="button"
                onClick={() => fillDemo(u.email, u.password)}
                className="flex flex-1 flex-col items-center gap-1.5 rounded-lg border border-border bg-background py-2.5 text-xs hover:bg-accent transition-colors"
              >
                <u.icon className={`h-4 w-4 ${u.color}`} />
                <span className="font-medium text-foreground">{u.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Restaurant OS — internal use only</p>
    </div>
  )
}
