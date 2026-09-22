import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requirePermission } from '@/lib/auth/session'
import { updateRecipeSchema } from '@/lib/validation/recipe.schema'
import { getRecipeCostBreakdown } from '@/lib/services/recipe.service'
import { recomputeAvailability } from '@/lib/services/menu.service'
import { writeAuditLog } from '@/lib/audit'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ menuItemId: string }> }) {
  try {
    await requireUser()
    const { menuItemId } = await params
    const breakdown = await getRecipeCostBreakdown(menuItemId)
    return NextResponse.json(breakdown)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ menuItemId: string }> }) {
  try {
    const user = await requirePermission('menu.manage')
    const { menuItemId } = await params
    const { ingredients } = updateRecipeSchema.parse(await req.json())

    await prisma.$transaction(async (tx) => {
      const before = await tx.recipeItem.findMany({ where: { menuItemId } })

      await tx.recipeItem.deleteMany({ where: { menuItemId } })
      await tx.recipeItem.createMany({
        data: ingredients.map((i) => ({
          menuItemId,
          inventoryItemId: i.inventoryItemId,
          quantity: i.quantity,
        })),
      })
      await recomputeAvailability(tx, [menuItemId])

      await writeAuditLog(tx, {
        userId: user.sub,
        action: 'menu_item.recipe_changed',
        entityType: 'MenuItem',
        entityId: menuItemId,
        beforeData: before,
        afterData: ingredients,
      })
    })

    const breakdown = await getRecipeCostBreakdown(menuItemId)
    return NextResponse.json(breakdown)
  } catch (err) {
    return handleApiError(err)
  }
}
