import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import { receiveStockSchema } from '@/lib/validation/payment.schema'
import { receiveStock } from '@/lib/services/inventory.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const createInventoryItemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  reorderLevel: z.number().nonnegative().default(0),
})

export async function GET() {
  try {
    await requireRole('admin')
    const items = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(items)
  } catch (err) {
    return handleApiError(err)
  }
}

// Create a new inventory item (no stock yet)
export async function POST(req: NextRequest) {
  try {
    await requireRole('admin')
    const body = createInventoryItemSchema.parse(await req.json())
    const item = await prisma.inventoryItem.create({ data: body })
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}

// Receive stock into an existing inventory item
export async function PUT(req: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = receiveStockSchema.parse(await req.json())
    const item = await receiveStock({ ...body, recordedById: user.sub })
    return NextResponse.json(item)
  } catch (err) {
    return handleApiError(err)
  }
}