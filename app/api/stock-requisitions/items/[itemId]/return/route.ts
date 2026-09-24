import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { recordLocationReturnSchema } from '@/lib/validation/stock-requisition.schema'
import { recordLocationStockReturn } from '@/lib/services/stock-requisition.service'
import { handleApiError } from '@/lib/api-error'

// Role is refined in the service: only the requisition's own location
// (kitchen role for a kitchen requisition, cashier for bar) or admin — same
// rule as receive.
export async function POST(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const user = await requirePermission('requisitions.manage')
    const { itemId } = await params
    const body = recordLocationReturnSchema.parse(await req.json())

    const result = await recordLocationStockReturn({
      requisitionItemId: itemId,
      ...body,
      userId: user.sub,
      permissions: user.role.permissions,
      homeArea: user.role.homeArea,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
