import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: {
        supplier: { select: { name: true } },
        items: { include: { inventoryItem: { select: { name: true, unit: true } } } },
        createdBy: { select: { name: true } },
      },
    })
    return NextResponse.json(po)
  } catch (err) {
    return handleApiError(err)
  }
}
