import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { getMenuItemDetail } from '@/lib/services/profit.service'
import { parseReportDateRange } from '@/lib/validation/report.schema'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('reports.view')
    const { id } = await params
    const { from, to } = parseReportDateRange(req.nextUrl.searchParams)

    const detail = await getMenuItemDetail({ menuItemId: id, from, to })

    return NextResponse.json({ ...detail, range: { from, to } })
  } catch (err) {
    return handleApiError(err)
  }
}
