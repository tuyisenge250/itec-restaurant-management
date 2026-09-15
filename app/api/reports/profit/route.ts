import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getProfitSummary, getProfitByMenuItem, getProfitTrend, getWasteCost } from '@/lib/services/profit.service'
import { parseReportDateRange } from '@/lib/validation/report.schema'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    await requireRole('admin')
    const { from, to } = parseReportDateRange(req.nextUrl.searchParams)

    const [summary, byItem, trend, waste] = await Promise.all([
      getProfitSummary({ from, to }),
      getProfitByMenuItem({ from, to }),
      getProfitTrend({ from, to }),
      getWasteCost({ from, to }),
    ])

    return NextResponse.json({ summary, byItem, trend, waste, range: { from, to } })
  } catch (err) {
    return handleApiError(err)
  }
}