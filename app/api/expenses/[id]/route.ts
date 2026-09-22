import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { updateExpenseSchema } from '@/lib/validation/expense.schema'
import { updateExpense, deleteExpense } from '@/lib/services/expense.service'
import { handleApiError } from '@/lib/api-error'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('expenses.manage')
    const { id } = await params
    const body = updateExpenseSchema.parse(await req.json())
    const expense = await updateExpense(id, body, user.sub)
    return NextResponse.json(expense)
  } catch (err) {
    return handleApiError(err)
  }
}

// Soft delete — an isDeleted flag, not a hard DELETE — so a report run for a
// past period stays reproducible even after someone removes a bad entry.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('expenses.manage')
    const { id } = await params
    await deleteExpense(id, user.sub)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
