import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

// Full detail view for one PO: who created/approved it, every goods receipt
// (and who received it), and the complete status-change audit trail — the
// "click a row, see everything, including who moved it" view.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('purchase_orders.manage')
    const { id } = await params

    const [po, auditLog] = await Promise.all([
      prisma.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: {
          supplier: { select: { name: true, phone: true, email: true } },
          items: { include: { inventoryItem: { select: { name: true, unit: true } } } },
          createdBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
          reorderedFrom: { select: { id: true, poNumber: true, createdAt: true } },
          goodsReceipts: {
            orderBy: { receivedAt: 'desc' },
            include: {
              receivedBy: { select: { name: true } },
              lines: {
                include: {
                  purchaseOrderItem: { include: { inventoryItem: { select: { name: true, unit: true } } } },
                },
              },
            },
          },
          payments: {
            orderBy: { createdAt: 'desc' },
            include: { recordedBy: { select: { name: true } } },
          },
          coveredRequisitions: { select: { id: true, location: true, status: true } },
        },
      }),
      prisma.auditLog.findMany({
        where: { entityType: 'PurchaseOrder', entityId: id },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true } } },
      }),
    ])

    return NextResponse.json({ ...po, auditLog })
  } catch (err) {
    return handleApiError(err)
  }
}
