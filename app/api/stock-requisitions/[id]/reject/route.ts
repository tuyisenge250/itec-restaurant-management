import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { rejectRequisitionSchema } from '@/lib/validation/stock-requisition.schema'
import { rejectRequisition } from '@/lib/services/stock-requisition.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('requisitions.review')
    const { id } = await params
    const body = rejectRequisitionSchema.parse(await req.json())

    const requisition = await rejectRequisition({ requisitionId: id, ...body, userId: user.sub, permissions: user.role.permissions })
    return NextResponse.json(requisition)
  } catch (err) {
    return handleApiError(err)
  }
}
