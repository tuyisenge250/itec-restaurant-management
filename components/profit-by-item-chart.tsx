'use client'

import { Cell, Pie, PieChart } from 'recharts'
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { rwf } from '@/lib/utils'

// Monochrome ramp off the brand primary (--primary: #871618), darkest first.
const RED_SHADES = ['#871618', '#A32226', '#C23238', '#DC6266', '#E9989B', '#F4C4C6']

type Item = { name: string; profit: number }

export function ProfitByItemChart({ items }: { items: Item[] }) {
  const top = items.filter((i) => i.profit > 0).slice(0, 5)
  const otherProfit = items.slice(5).reduce((sum, i) => sum + Math.max(i.profit, 0), 0)
  const data = otherProfit > 0 ? [...top, { name: 'Other', profit: otherProfit }] : top

  const chartConfig = data.reduce((config, item, i) => {
    config[item.name] = { label: item.name, color: RED_SHADES[i % RED_SHADES.length] }
    return config
  }, {} as ChartConfig)

  if (data.length === 0) {
    return <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">No profit data for this range.</p>
  }

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-64">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="name"
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-mono font-medium text-foreground">{rwf(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <Pie data={data} dataKey="profit" nameKey="name" innerRadius={50} strokeWidth={4}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={RED_SHADES[index % RED_SHADES.length]} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="name" />} className="flex-wrap gap-x-4 gap-y-1" />
      </PieChart>
    </ChartContainer>
  )
}
