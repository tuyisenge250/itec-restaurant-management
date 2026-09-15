import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { createPrepRecipeSchema } from '@/lib/validation/prep-recipe.schema'
import { createPrepRecipe } from '@/lib/services/prep-recipe.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
    await requireRole('admin', 'kitchen')
    const recipes = await prisma.prepRecipe.findMany({
      include: { outputItem: true, inputs: { include: { inputItem: true } } },
    })
    return NextResponse.json(recipes)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('admin')
    const body = createPrepRecipeSchema.parse(await req.json())
    const recipe = await createPrepRecipe(body)
    return NextResponse.json(recipe, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
