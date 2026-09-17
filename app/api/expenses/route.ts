import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { createExpenseSchema } from '@/lib/validation/expense.schema'
import { createExpense, listExpenses } from '@/lib/services/expense.service'
import { handleApiError } from '@/lib/api-error'
import { BusinessRuleError } from '@/lib/errors'
import { parseUpperBoundDate } from '@/lib/date-range'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  try {
    await requireRole('admin')
    const { searchParams } = req.nextUrl
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const categoryId = searchParams.get('categoryId') ?? undefined
    const isRecurringParam = searchParams.get('isRecurring')
    const isRecurring = isRecurringParam === null ? undefined : isRecurringParam === 'true'
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
    if (!Number.isFinite(page)) throw new BusinessRuleError('Invalid page number')

    const result = await listExpenses({
      from: from ? new Date(from) : undefined,
      to: to ? parseUpperBoundDate(to) : undefined,
      categoryId,
      isRecurring,
      page,
      pageSize: PAGE_SIZE,
    })
    return NextResponse.json(result)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('admin')
    const body = createExpenseSchema.parse(await req.json())
    const expense = await createExpense({ ...body, recordedById: user.sub })
    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
