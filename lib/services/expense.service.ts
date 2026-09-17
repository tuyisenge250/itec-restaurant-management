import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { BusinessRuleError, NotFoundError } from '@/lib/errors'

export async function listExpenseCategories(params?: { isActive?: boolean }) {
  return prisma.expenseCategory.findMany({
    where: params?.isActive !== undefined ? { isActive: params.isActive } : undefined,
    orderBy: { name: 'asc' },
  })
}

export async function createExpenseCategory(params: { name: string }) {
  return prisma.expenseCategory.create({ data: params })
}

export async function updateExpenseCategory(id: string, data: { name?: string; isActive?: boolean }) {
  // Deactivating never touches existing Expense rows — they keep their
  // categoryId regardless. The isActive check that matters lives in
  // createExpense, not here.
  return prisma.expenseCategory.update({ where: { id }, data })
}

export async function createExpense(params: {
  categoryId: string
  amount: number
  expenseDate: string
  description?: string
  isRecurring: boolean
  recordedById: string
}) {
  const { categoryId, amount, expenseDate, description, isRecurring, recordedById } = params

  return prisma.$transaction(async (tx) => {
    const category = await tx.expenseCategory.findUnique({ where: { id: categoryId } })
    if (!category) throw new NotFoundError('Expense category not found')
    if (!category.isActive) {
      throw new BusinessRuleError('Cannot log an expense against an inactive category')
    }

    const expense = await tx.expense.create({
      data: {
        categoryId,
        amount,
        expenseDate: new Date(expenseDate),
        description,
        isRecurring,
        recordedById,
      },
    })

    await writeAuditLog(tx, {
      userId: recordedById,
      action: 'expense.created',
      entityType: 'Expense',
      entityId: expense.id,
      afterData: expense,
    })

    return expense
  })
}

export async function listExpenses(params: {
  from?: Date
  to?: Date
  categoryId?: string
  isRecurring?: boolean
  page: number
  pageSize: number
}) {
  const { from, to, categoryId, isRecurring, page, pageSize } = params

  const where = {
    isDeleted: false,
    categoryId,
    isRecurring,
    expenseDate: from || to ? { gte: from, lte: to } : undefined,
  }

  const [entries, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      include: { category: { select: { name: true } }, recordedBy: { select: { name: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.expense.count({ where }),
  ])

  return { entries, total, page, pageSize }
}

/**
 * expenseDate is deliberately NOT editable here (the conservative choice per
 * the brief: once an expense is logged against a period, that period is
 * fixed) — only amount/category/description/isRecurring can change. If a
 * date was wrong, the correct fix is delete + re-create with the right date,
 * which also keeps the audit trail honest about what happened when.
 */
export async function updateExpense(
  id: string,
  data: { categoryId?: string; amount?: number; description?: string; isRecurring?: boolean },
  editedById: string
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.expense.findUnique({ where: { id } })
    if (!before || before.isDeleted) throw new NotFoundError('Expense not found')

    if (data.categoryId) {
      const category = await tx.expenseCategory.findUnique({ where: { id: data.categoryId } })
      if (!category) throw new NotFoundError('Expense category not found')
      if (!category.isActive) {
        throw new BusinessRuleError('Cannot move an expense onto an inactive category')
      }
    }

    const updated = await tx.expense.update({ where: { id }, data })

    await writeAuditLog(tx, {
      userId: editedById,
      action: 'expense.updated',
      entityType: 'Expense',
      entityId: id,
      beforeData: before,
      afterData: updated,
    })

    return updated
  })
}

export async function deleteExpense(id: string, deletedById: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.expense.findUnique({ where: { id } })
    if (!before || before.isDeleted) throw new NotFoundError('Expense not found')

    const updated = await tx.expense.update({ where: { id }, data: { isDeleted: true } })

    await writeAuditLog(tx, {
      userId: deletedById,
      action: 'expense.deleted',
      entityType: 'Expense',
      entityId: id,
      beforeData: before,
      afterData: updated,
    })

    return updated
  })
}

/**
 * Grouped totals for the profit report's expense breakdown. Filters by
 * expenseDate — never createdAt — same as listExpenses.
 */
export async function getExpenseSummary(params: { from: Date; to: Date }) {
  const { from, to } = params

  const expenses = await prisma.expense.findMany({
    where: { isDeleted: false, expenseDate: { gte: from, lte: to } },
    include: { category: { select: { name: true } } },
  })

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  const byCategory = new Map<string, number>()
  for (const e of expenses) {
    byCategory.set(e.category.name, (byCategory.get(e.category.name) ?? 0) + e.amount)
  }
  const expensesByCategory = Array.from(byCategory.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  return { totalExpenses, expensesByCategory }
}
