'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { rwf } from '@/lib/utils'

const chartConfig = {
  profit: { label: 'Profit', color: 'var(--primary)' },
} satisfies ChartConfig

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function formatDay(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ProfitTrendChart({ data }: { data: { date: string; profit: number }[] }) {
  if (data.length === 0) {
    return <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">No profit data for this range.</p>
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ left: 12, right: 12, top: 8 }}>
        <defs>
          <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatDay} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={48} tickFormatter={(v) => compact.format(v)} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatDay(String(value))}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-mono font-medium text-foreground">{rwf(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <Area dataKey="profit" type="monotone" fill="url(#profitFill)" stroke="var(--color-profit)" strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  )
}
