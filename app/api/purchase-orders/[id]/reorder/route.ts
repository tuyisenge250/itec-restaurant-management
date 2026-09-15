import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { reorderPurchaseOrder } from '@/lib/services/purchase-order.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('admin')
    const { id } = await params
    const po = await reorderPurchaseOrder(id, user.sub)
    return NextResponse.json(po, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
