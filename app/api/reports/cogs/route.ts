import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getProfitByMenuItem, getWasteCost } from '@/lib/services/profit.service'
import { handleApiError } from '@/lib/api-error'

function parseDateRange(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  return {
    from: from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0)),
    to: to ? new Date(to) : new Date(),
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireRole('admin')
    const { from, to } = parseDateRange(req)

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