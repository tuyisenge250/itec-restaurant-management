import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getPaymentMethodBreakdown } from '@/lib/services/profit.service'
import { parseReportDateRange } from '@/lib/validation/report.schema'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    await requireRole('admin')
    const { from, to } = parseReportDateRange(req.nextUrl.searchParams)
    const byMethod = await getPaymentMethodBreakdown({ from, to })
    return NextResponse.json({ range: { from, to }, byMethod })
  } catch (err) {
    return handleApiError(err)
  }
}
