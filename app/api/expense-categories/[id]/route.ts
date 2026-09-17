import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { updateExpenseCategorySchema } from '@/lib/validation/expense.schema'
import { updateExpenseCategory } from '@/lib/services/expense.service'
import { handleApiError } from '@/lib/api-error'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('admin')
    const { id } = await params
    const body = updateExpenseCategorySchema.parse(await req.json())
    const category = await updateExpenseCategory(id, body)
    return NextResponse.json(category)
  } catch (err) {
    return handleApiError(err)
  }
}
