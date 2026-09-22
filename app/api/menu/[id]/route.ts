import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireUser, requirePermission } from '@/lib/auth/session'
import { updateMenuItemSchema } from '@/lib/validation/menu.schema'
import { writeAuditLog } from '@/lib/audit'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'
import { ConflictError } from '@/lib/errors'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('menu.manage')
    const { id } = await params
    const body = updateMenuItemSchema.parse(await req.json())

    const item = await prisma.$transaction(async (tx) => {
      const before = await tx.menuItem.findUniqueOrThrow({ where: { id } })
      const after = await tx.menuItem.update({ where: { id }, data: body })

      if (body.price !== undefined && body.price !== before.price) {
        await writeAuditLog(tx, {
          userId: user.sub,
          action: 'menu_item.price_changed',
          entityType: 'MenuItem',
          entityId: id,
          beforeData: before,
          afterData: after,
        })
      }

      return after
    })

    return NextResponse.json(item)
  } catch (err) {
    return handleApiError(err)
  }
}

// isAvailable is a fully auto-recomputed stock flag now (see menu.service),
// so there's no separate "deactivated" state to soft-delete into. A menu
// item with order history can't be deleted at all — the FK from OrderItem
// protects it — everything else is a real delete.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('menu.manage')
    const { id } = await params
    await prisma.menuItem.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return handleApiError(
        new ConflictError('Cannot delete a menu item that already has order history')
      )
    }
    return handleApiError(err)
  }
}
