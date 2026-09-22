import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { getProfitSummary, getProfitByMenuItem, getProfitTrend, getWasteCost } from '@/lib/services/profit.service'
import { getExpenseSummary } from '@/lib/services/expense.service'
import { parseReportDateRange } from '@/lib/validation/report.schema'
import { handleApiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    await requirePermission('reports.view')
    const { from, to } = parseReportDateRange(req.nextUrl.searchParams)

    const [profitSummary, byItem, trend, waste, expenseSummary] = await Promise.all([
      getProfitSummary({ from, to }),
      getProfitByMenuItem({ from, to }),
      getProfitTrend({ from, to }),
      getWasteCost({ from, to }),
      getExpenseSummary({ from, to }),
    ])

    // profit.service's revenue/cogs/profit calculation is untouched here —
    // it still folds PrepProductionRun.laborCost into recipe COGS. Whether
    // that double-counts labor once a "Salaries" expense category exists is
    // an open question the human owner needs to decide before netProfit's
    // inputs can be trusted; until then this only adds the expense side on
    // top without touching grossProfit/COGS.
    //
    // Waste isn't a recorded Expense row (it comes from inventory waste
    // transactions), but it's still money lost — folded in here as its own
    // "Waste" category so it reduces totalExpenses/netProfit like any other
    // expense, instead of sitting to the side where it never hit the bottom line.
    const expensesByCategory = waste.totalCost > 0
      ? [...expenseSummary.expensesByCategory, { category: 'Waste', amount: waste.totalCost }]
      : expenseSummary.expensesByCategory
    const totalExpenses = expenseSummary.totalExpenses + waste.totalCost

    const summary = {
      ...profitSummary,
      totalExpenses,
      expensesByCategory,
      netProfit: profitSummary.profit - totalExpenses,
    }

    return NextResponse.json({ summary, byItem, trend, waste, range: { from, to } })
  } catch (err) {
    return handleApiError(err)
  }
}