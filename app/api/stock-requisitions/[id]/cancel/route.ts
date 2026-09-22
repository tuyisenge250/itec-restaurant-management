import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { cancelRequisition } from '@/lib/services/stock-requisition.service'
import { handleApiError } from '@/lib/api-error'

// Role beyond admin/kitchen/cashier is checked in the service, since
// cancelling your own request is allowed regardless of location.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('requisitions.manage')
    const { id } = await params

    const requisition = await cancelRequisition({ requisitionId: id, userId: user.sub, permissions: user.role.permissions })
    return NextResponse.json(requisition)
  } catch (err) {
    return handleApiError(err)
  }
}
