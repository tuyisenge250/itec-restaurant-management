import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireUser } from '@/lib/auth/session'
import { createMenuCategorySchema } from '@/lib/validation/menu.schema'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
    await requireUser()
    const categories = await prisma.menuCategory.findMany({ orderBy: { sortOrder: 'asc' } })
    return NextResponse.json(categories)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission('menu.manage')
    const body = createMenuCategorySchema.parse(await req.json())
    const category = await prisma.menuCategory.create({ data: body })
    return NextResponse.json(category, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
