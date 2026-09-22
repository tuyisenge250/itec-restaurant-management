import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { createExpenseCategorySchema } from '@/lib/validation/expense.schema'
import { listExpenseCategories, createExpenseCategory } from '@/lib/services/expense.service'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('expenses.manage')
    const isActiveParam = req.nextUrl.searchParams.get('isActive')
    const isActive = isActiveParam === null ? undefined : isActiveParam === 'true'

    const categories = await listExpenseCategories({ isActive })
    return NextResponse.json(categories)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission('expenses.manage')
    const body = createExpenseCategorySchema.parse(await req.json())
    const category = await createExpenseCategory(body)
    return NextResponse.json(category, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
