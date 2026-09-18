import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { previewProductionOrderIngredients } from '@/lib/services/prep-production-order.service'
import { BusinessRuleError } from '@/lib/errors'
import { handleApiError } from '@/lib/api-error'

// Read-only "what would this order need" preview — scaled from the recipe's
// ratio to a target quantity, no stock touched. Lets admin see (and outside
// orders in particular rely on this before committing, since those actually
// consume the ingredients the moment the order is created) what a
// production order would draw before submitting it.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('admin', 'kitchen', 'waiter')
    const { id } = await params
    const targetQuantity = Number(req.nextUrl.searchParams.get('targetQuantity'))
    if (!targetQuantity || targetQuantity <= 0) {
      throw new BusinessRuleError('targetQuantity must be a positive number')
    }

    const ingredients = await previewProductionOrderIngredients(id, targetQuantity)
    return NextResponse.json(ingredients)
  } catch (err) {
    return handleApiError(err)
  }
}
