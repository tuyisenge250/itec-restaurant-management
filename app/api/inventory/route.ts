import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { receiveStockSchema } from '@/lib/validation/payment.schema'
import { receiveStock } from '@/lib/services/inventory.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
    await requireRole('admin')
    const items = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(items)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = receiveStockSchema.parse(await req.json())

    const item = await receiveStock({ ...body, recordedById: user.sub })
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}