import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { producePrepRecipeSchema } from '@/lib/validation/prep-recipe.schema'
import { producePrepRecipe } from '@/lib/services/prep-recipe.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('admin', 'kitchen')
    const { id } = await params
    const body = producePrepRecipeSchema.parse(await req.json())

    const run = await producePrepRecipe({ prepRecipeId: id, ...body, recordedById: user.sub })
    return NextResponse.json(run, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
