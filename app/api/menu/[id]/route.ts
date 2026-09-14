import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const updateMenuItemSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  price: z.number().positive().optional(),
  isAvailable: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser()
    const { id } = await params
    const item = await prisma.menuItem.findUniqueOrThrow({
      where: { id },
      include: { recipeItems: { include: { inventoryItem: { select: { name: true, unit: true } } } } },
    })
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
    const body = updateMenuItemSchema.parse(await req.json())
    const item = await prisma.menuItem.update({ where: { id }, data: body })
    return NextResponse.json(item)
  } catch (err) {
    return handleApiError(err)
  }
}

// Soft delete — marks unavailable instead of hard delete to preserve order history
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    await prisma.menuItem.update({ where: { id }, data: { isAvailable: false } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
