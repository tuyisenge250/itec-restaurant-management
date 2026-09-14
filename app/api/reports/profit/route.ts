import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getProfitSummary, getProfitByMenuItem, getWasteCost } from '@/lib/services/profit.service'
import { handleApiError } from '@/lib/api-error'

function parseDateRange(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  return {
    from: from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0)), // default: today
    to: to ? new Date(to) : new Date(),
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireRole('admin')
    const { from, to } = parseDateRange(req)

    const [summary, byItem, waste] = await Promise.all([
      getProfitSummary({ from, to }),
      getProfitByMenuItem({ from, to }),
      getWasteCost({ from, to }),
    ])

    return NextResponse.json({ summary, byItem, waste, range: { from, to } })
  } catch (err) {
    return handleApiError(err)
  }
}