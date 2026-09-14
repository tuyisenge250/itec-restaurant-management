import Link from 'next/link'
import {
  UtensilsCrossed, ArrowRight, ShoppingCart, FlaskConical,
  Users, BarChart3, ChefHat, ClipboardList, CreditCard,
  TrendingUp, Package, Utensils,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SeeHowButton } from '@/components/see-how-button'

// ── Reusable logo mark ────────────────────────────────────────────────────────
function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const icon = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <div className={`flex items-center justify-center rounded-lg bg-primary ${box}`}>
      <UtensilsCrossed className={`${icon} text-primary-foreground`} />
    </div>
  )
}

// ── Mock stat card for hero visual ────────────────────────────────────────────
function HeroStatCard() {
  return (
    <Card className="w-full max-w-xs shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Today's Profit</p>
        <p className="mt-1 text-3xl font-bold text-foreground">$487.20</p>
        <div className="mt-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-success" />
          <span className="text-xs text-success">+8% vs yesterday</span>
        </div>
        <Separator className="my-3" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Revenue</span><span className="font-medium text-foreground">$1,284</span>
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span>COGS</span><span className="font-medium text-foreground">$796</span>
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span>Margin</span><span className="font-medium text-foreground">37.9%</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Feature grid data ─────────────────────────────────────────────────────────
const features = [
  { icon: Package,     title: 'Purchase to plate tracking',       desc: 'Every ingredient is traced from supplier invoice to finished dish.' },
  { icon: FlaskConical, title: 'Live recipe costing',             desc: 'Recipe costs update automatically when ingredient prices change.' },
  { icon: Users,       title: 'Role-based access',                desc: 'Admin, kitchen, and waiter each see only what they need.' },
  { icon: BarChart3,   title: 'Real-time profit reports',         desc: 'COGS, waste, and margin calculated on every order, instantly.' },
]

// ── How it works steps ────────────────────────────────────────────────────────
const steps = [
  { icon: ShoppingCart, label: 'Purchase',  desc: 'Log supplier orders and receive stock into inventory.' },
  { icon: ChefHat,      label: 'Prepare',   desc: 'Kitchen fulfils orders; ingredients are deducted automatically.' },
  { icon: TrendingUp,   label: 'Profit',    desc: 'See real-time COGS, revenue, and margin per dish and per day.' },
]

// ── Role cards ────────────────────────────────────────────────────────────────
const roles = [
  { icon: ClipboardList, role: 'Admin',   color: 'bg-secondary text-secondary-foreground', desc: 'Manage suppliers, inventory, recipes, menu, users, and reports.' },
  { icon: ChefHat,       role: 'Kitchen', color: 'bg-warning text-warning-foreground',     desc: 'View the live order queue and advance orders through the kitchen.' },
  { icon: CreditCard,    role: 'Waiter',  color: 'bg-success text-success-foreground',     desc: 'Place orders, track table status, and record payments.' },
]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* 1. Nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark size="sm" />
            <span className="font-semibold text-foreground">Restaurant OS</span>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm">Log in</Button>
          </Link>
        </div>
      </header>

      {/* 2. Hero */}
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-12 px-4 py-20 sm:px-6 lg:flex-row lg:py-28">
        <div className="flex flex-1 flex-col gap-6 text-center lg:text-left">
          <Badge className="w-fit self-center bg-secondary text-secondary-foreground lg:self-start">
            Built for restaurant operators
          </Badge>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            Know your margin<br />on every plate.
          </h1>
          <p className="max-w-md self-center text-lg text-muted-foreground lg:self-start">
            Restaurant OS connects purchasing, kitchen, and payments into one tool — so you always know what you're making and what it costs.
          </p>
          <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link href="/login">
              <Button size="lg">
                Get started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" size="lg">
              See how it works
            </Button>
          </div>
        </div>
        <div className="flex flex-1 justify-center lg:justify-end">
          <HeroStatCard />
        </div>
      </section>

      {/* 3. Feature grid */}
      <section className="bg-accent py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-foreground">Everything your kitchen needs</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card key={f.title}>
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-semibold text-foreground">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 4. How it works */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-foreground">How it works</h2>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
            {steps.map((step, i) => (
              <div key={step.label} className="flex flex-col items-center sm:flex-row sm:items-start">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-semibold text-foreground">{step.label}</p>
                  <p className="max-w-[180px] text-sm text-muted-foreground">{step.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="mx-6 mt-7 hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Role callout */}
      <section className="bg-accent py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-foreground">One system, three roles</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {roles.map((r) => (
              <Card key={r.role}>
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${r.color}`}>
                      <r.icon className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-foreground">{r.role}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Footer CTA */}
      <section className="bg-accent py-16">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 text-center sm:px-6">
          <LogoMark size="lg" />
          <h2 className="text-2xl font-bold text-foreground">Ready to take control of your margins?</h2>
          <p className="text-muted-foreground">Log in and start tracking every ingredient, order, and profit in real time.</p>
          <Link href="/login">
            <Button size="lg">
              Log in now <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="border-t border-border bg-card py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:px-6">
          <div className="flex items-center gap-2">
            <Utensils className="h-4 w-4" />
            <span>Restaurant OS</span>
          </div>
          <div className="flex gap-4">
            <span className="cursor-default">Privacy</span>
            <span className="cursor-default">Terms</span>
            <span className="cursor-default">Support</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
