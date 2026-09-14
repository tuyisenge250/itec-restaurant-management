'use client'

import { useState } from 'react'
import { UtensilsCrossed, Eye, EyeOff, Loader2, ShieldCheck, ChefHat, ConciergeBell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

const PREVIEW_ERROR   = false
const PREVIEW_LOADING = false

const demoUsers = [
  { label: 'Admin',   email: 'admin@demo.com',   password: 'demo1234', icon: ShieldCheck,   color: 'text-primary' },
  { label: 'Kitchen', email: 'kitchen@demo.com', password: 'demo1234', icon: ChefHat,       color: 'text-warning' },
  { label: 'Waiter',  email: 'waiter@demo.com',  password: 'demo1234', icon: ConciergeBell, color: 'text-success' },
]

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const isError   = PREVIEW_ERROR
  const isLoading = PREVIEW_LOADING

  function fillDemo(e: string, p: string) {
    setEmail(e)
    setPassword(p)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">

      {/* Logo above card */}
      <div className="mb-6 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <UtensilsCrossed className="h-6 w-6 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold text-foreground">Restaurant OS</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">

        {/* Heading */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Log in to Restaurant OS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your credentials to continue</p>
        </div>

        {/* Error alert */}
        {isError && (
          <Alert variant="destructive" className="mb-5">
            <AlertDescription>Invalid email or password. Please try again.</AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={(e) => { e.preventDefault(); console.log('login', { email, password }) }} className="flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isLoading}
                className="pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="mt-1 w-full" disabled={isLoading}>
            {isLoading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging in…</>
              : 'Log in'
            }
          </Button>

        </form>

        {/* Demo quick-access */}
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

      {/* Footer note */}
      <p className="mt-6 text-xs text-muted-foreground">Restaurant OS — internal use only</p>
    </div>
  )
}
