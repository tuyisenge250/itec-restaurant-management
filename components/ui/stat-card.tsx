import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  trend?: { value: string; up: boolean }
}

export function StatCard({ icon: Icon, label, value, trend }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-2xl font-semibold text-foreground">{value}</span>
            {trend && (
              <span className={`flex items-center gap-1 text-xs ${trend.up ? 'text-success' : 'text-destructive'}`}>
                {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trend.value}
              </span>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
