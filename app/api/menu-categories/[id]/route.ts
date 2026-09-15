import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { updateMenuCategorySchema } from '@/lib/validation/menu.schema'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'
import { ConflictError } from '@/lib/errors'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('admin')
    const { id } = await params
    const body = updateMenuCategorySchema.parse(await req.json())
    const category = await prisma.menuCategory.update({ where: { id }, data: body })
    return NextResponse.json(category)
  } catch (err) {
    return handleApiError(err)
  }
}

// Deleting a category that still has menu items attached is rejected rather
// than silently orphaning them — reassign the items first.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('admin')
    const { id } = await params

    const itemCount = await prisma.menuItem.count({ where: { categoryId: id } })
    if (itemCount > 0) {
      throw new ConflictError(
        `Cannot delete category with ${itemCount} menu item(s) still assigned — reassign them first`
      )
    }

    await prisma.menuCategory.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
