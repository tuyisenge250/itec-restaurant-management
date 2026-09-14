import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { getOrderWithDetails } from '@/lib/services/order.service'
import { handleApiError } from '@/lib/api-error'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser()
    const { id } = await params
    const order = await getOrderWithDetails(id)
    return NextResponse.json(order)
  } catch (err) {
    return handleApiError(err)
  }
}