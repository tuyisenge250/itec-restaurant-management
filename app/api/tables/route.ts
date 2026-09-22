import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

// There's no Table entity in the schema — a "table" is just whatever name a
// waiter typed when starting an order. This returns every distinct name
// ever used, restaurant-wide, so the new-order picker can offer a dropdown
// instead of free text, without exposing any order/waiter-scoped data (a
// waiter can see every table name that's been used even though they can't
// see other waiters' orders on it).
export async function GET() {
  try {
    await requirePermission('tables.view')

    const rows = await prisma.order.findMany({
      distinct: ['table'],
      select: { table: true },
      orderBy: { table: 'asc' },
    })

    return NextResponse.json(rows.map((r) => r.table))
  } catch (err) {
    return handleApiError(err)
  }
}
