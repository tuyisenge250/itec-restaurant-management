import { NextRequest, NextResponse } from 'next/server'
import { Prisma, InventoryTransactionType } from '@prisma/client'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const TRANSACTION_TYPES = Object.values(InventoryTransactionType)

// Read-only ledger view for one item — the audit trail, never editable here.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('admin')
    const { id } = await params
    const { searchParams } = req.nextUrl
    const typeParam = searchParams.get('type')
    const type = TRANSACTION_TYPES.find((t) => t === typeParam)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Prisma.InventoryTransactionWhereInput = { inventoryItemId: id, type }
    if (from || to) {
      where.createdAt = { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined }
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { recordedBy: { select: { name: true } } },
      take: 200,
    })

    return NextResponse.json(transactions)
  } catch (err) {
    return handleApiError(err)
  }
}
