import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { getProfitByMenuItem, getWasteCost } from '@/lib/services/profit.service'
import { parseReportDateRange } from '@/lib/validation/report.schema'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('reports.view')
    const { from, to } = parseReportDateRange(req.nextUrl.searchParams)

    const [byItem, waste] = await Promise.all([
      getProfitByMenuItem({ from, to }),
      getWasteCost({ from, to }),
    ])

    const soldCogs = byItem.reduce((sum, item) => sum + item.cogs, 0)

    return NextResponse.json({
      range: { from, to },
      soldCogs, // cost of ingredients in items actually sold
      wasteCost: waste.totalCost, // cost of ingredients written off, not sold
      totalCogs: soldCogs + waste.totalCost,
      byItem: byItem.map((i) => ({ menuItemId: i.menuItemId, name: i.name, cogs: i.cogs })),
    })
  } catch (err) {
    return handleApiError(err)
  }
}