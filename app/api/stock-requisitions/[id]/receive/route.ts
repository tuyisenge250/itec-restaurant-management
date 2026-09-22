import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { receiveRequisitionSchema } from '@/lib/validation/stock-requisition.schema'
import { receiveRequisition } from '@/lib/services/stock-requisition.service'
import { handleApiError } from '@/lib/api-error'

// Role is refined in the service: only the requisition's own location
// (kitchen role for a kitchen requisition, cashier for bar) or admin.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('requisitions.manage')
    const { id } = await params
    const body = receiveRequisitionSchema.parse(await req.json())

    const requisition = await receiveRequisition({
      requisitionId: id,
      ...body,
      userId: user.sub,
      permissions: user.role.permissions,
      homeArea: user.role.homeArea,
    })
    return NextResponse.json(requisition)
  } catch (err) {
    return handleApiError(err)
  }
}
