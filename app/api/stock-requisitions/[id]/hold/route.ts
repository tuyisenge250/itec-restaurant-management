import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { holdRequisition } from '@/lib/services/stock-requisition.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('requisitions.review')
    const { id } = await params
    const requisition = await holdRequisition({ requisitionId: id, userId: user.sub, permissions: user.role.permissions })
    return NextResponse.json(requisition)
  } catch (err) {
    return handleApiError(err)
  }
}
