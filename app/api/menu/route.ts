import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireRole } from '@/lib/auth/session'
import { createMenuItemSchema } from '@/lib/validation/menu.schema'
import { recomputeAvailability } from '@/lib/services/menu.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

// Returns every menu item regardless of availability — the admin menu page
// needs to see/manage unavailable items too. Ordering screens filter to
// isAvailable client-side instead of losing admin visibility here.
export async function GET() {
  try {
    await requireUser()
    const menuItems = await prisma.menuItem.findMany({
      include: {
        category: { select: { name: true } },
        recipeItems: { include: { inventoryItem: { select: { name: true, currentStock: true } } } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(menuItems)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('admin')
    const body = createMenuItemSchema.parse(await req.json())

    const menuItem = await prisma.$transaction(async (tx) => {
      const created = await tx.menuItem.create({
        data: {
          name: body.name,
          categoryId: body.categoryId,
          price: body.price,
          preparationCost: body.preparationCost,
          recipeItems: {
            create: body.recipe.map((r) => ({
              inventoryItemId: r.inventoryItemId,
              quantity: r.quantity,
            })),
          },
        },
        include: { recipeItems: true },
      })
      await recomputeAvailability(tx, [created.id])
      return tx.menuItem.findUniqueOrThrow({ where: { id: created.id }, include: { recipeItems: true } })
    })

    return NextResponse.json(menuItem, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
