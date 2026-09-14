import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireRole } from '@/lib/auth/session'
import { updateRecipeSchema } from '@/lib/validation/purchase-order.schema'
import { getRecipeCostBreakdown } from '@/lib/services/recipe.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ menuItemId: string }> }
) {
  try {
    await requireUser()
    const { menuItemId } = await params
    const breakdown = await getRecipeCostBreakdown(menuItemId)
    return NextResponse.json(breakdown)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ menuItemId: string }> }
) {
  try {
    await requireRole('admin')
    const { menuItemId } = await params
    const { ingredients } = updateRecipeSchema.parse(await req.json())

    await prisma.$transaction([
      prisma.recipeItem.deleteMany({ where: { menuItemId } }),
      prisma.recipeItem.createMany({
        data: ingredients.map((i) => ({
          menuItemId,
          inventoryItemId: i.inventoryItemId,
          quantity: i.quantity,
        })),
      }),
    ])

    const breakdown = await getRecipeCostBreakdown(menuItemId)
    return NextResponse.json(breakdown)
  } catch (err) {
    return handleApiError(err)
  }
}
