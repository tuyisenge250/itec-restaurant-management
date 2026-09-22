import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { adjustLocationStockSchema } from '@/lib/validation/stock-requisition.schema'
import { adjustLocationStock } from '@/lib/services/stock-requisition.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('location_stock.adjust')
    const body = adjustLocationStockSchema.parse(await req.json())

    await adjustLocationStock({ ...body, userId: user.sub, permissions: user.role.permissions })
    return new NextResponse(null, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
