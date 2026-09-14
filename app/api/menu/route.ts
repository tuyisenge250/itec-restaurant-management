import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const createMenuItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  price: z.number().positive(),
  recipe: z
    .array(z.object({ inventoryItemId: z.string().min(1), quantity: z.number().positive() }))
    .min(1),
})

export async function GET() {
  try {
    await requireUser()
    const menuItems = await prisma.menuItem.findMany({
      where: { isAvailable: true },
      orderBy: { category: 'asc' },
    })
    return NextResponse.json(menuItems)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = createMenuItemSchema.parse(await req.json())

    const menuItem = await prisma.menuItem.create({
      data: {
        name: body.name,
        category: body.category,
        price: body.price,
        recipeItems: {
          create: body.recipe.map((r) => ({
            inventoryItemId: r.inventoryItemId,
            quantity: r.quantity,
          })),
        },
      },
      include: { recipeItems: true },
    })

    return NextResponse.json(menuItem, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}