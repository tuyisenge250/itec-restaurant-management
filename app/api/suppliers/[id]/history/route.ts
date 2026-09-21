import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getSupplierHistory } from '@/lib/services/supplier-payment.service'
import { handleApiError } from '@/lib/api-error'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    const history = await getSupplierHistory(id)
    return NextResponse.json(history)
  } catch (err) {
    return handleApiError(err)
  }
}
