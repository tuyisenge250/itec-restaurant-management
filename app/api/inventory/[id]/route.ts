import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const updateInventoryItemSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  reorderLevel: z.number().nonnegative().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })
    return NextResponse.json(item)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    const body = updateInventoryItemSchema.parse(await req.json())
    const item = await prisma.inventoryItem.update({ where: { id }, data: body })
    return NextResponse.json(item)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    await prisma.inventoryItem.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
