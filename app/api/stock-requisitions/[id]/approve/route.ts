import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { approveRequisitionSchema } from '@/lib/validation/stock-requisition.schema'
import { approveRequisition } from '@/lib/services/stock-requisition.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('requisitions.review')
    const { id } = await params
    const body = approveRequisitionSchema.parse(await req.json())

    const requisition = await approveRequisition({ requisitionId: id, ...body, userId: user.sub, permissions: user.role.permissions })
    return NextResponse.json(requisition)
  } catch (err) {
    return handleApiError(err)
  }
}
