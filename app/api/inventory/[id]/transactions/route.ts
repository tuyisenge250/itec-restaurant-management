import { NextRequest, NextResponse } from 'next/server'
import { Prisma, InventoryTransactionType } from '@prisma/client'
import { requirePermission } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'
import { parseUpperBoundDate } from '@/lib/date-range'

const TRANSACTION_TYPES = Object.values(InventoryTransactionType)

// Read-only ledger view for one item — the audit trail, never editable here.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('inventory.manage')
    const { id } = await params
    const { searchParams } = req.nextUrl
    const typeParam = searchParams.get('type')
    const type = TRANSACTION_TYPES.find((t) => t === typeParam)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Prisma.InventoryTransactionWhereInput = { inventoryItemId: id, type }
    if (from || to) {
      where.createdAt = { gte: from ? new Date(from) : undefined, lte: to ? parseUpperBoundDate(to) : undefined }
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { recordedBy: { select: { name: true } } },
      take: 200,
    })

    // Consumption/receipt transactions only store a bare referenceId (an
    // OrderItem/PurchaseOrder/PrepRecipe id) — batch-resolve each kind so the
    // ledger can show full context (which order, which table, who prepared
    // it) instead of just an opaque id.
    const saleRefs = [...new Set(transactions.filter((t) => t.source === 'sale' && t.referenceId).map((t) => t.referenceId!))]
    const poRefs = [...new Set(transactions.filter((t) => t.source === 'purchase_order' && t.referenceId).map((t) => t.referenceId!))]
    const prepRefs = [...new Set(transactions.filter((t) => t.source === 'prep_production' && t.referenceId).map((t) => t.referenceId!))]
    // A production run's receipt transaction shares its lotId with the run's
    // producedLotId — that's how we tell an internal batch from an outside
    // one (referenceId alone is just the recipe, shared by every run of it).
    const productionLotIds = [
      ...new Set(transactions.filter((t) => t.source === 'prep_production' && t.type === 'receipt').map((t) => t.lotId)),
    ]

    const [orderItems, purchaseOrders, prepRecipes, productionRuns] = await Promise.all([
      saleRefs.length
        ? prisma.orderItem.findMany({
            where: { id: { in: saleRefs } },
            include: {
              menuItem: { select: { name: true, variantLabel: true } },
              preparedBy: { select: { name: true } },
              order: { select: { id: true, table: true, status: true, createdAt: true, createdBy: { select: { name: true } } } },
            },
          })
        : [],
      poRefs.length
        ? prisma.purchaseOrder.findMany({
            where: { id: { in: poRefs } },
            include: { supplier: { select: { name: true } } },
          })
        : [],
      prepRefs.length
        ? prisma.prepRecipe.findMany({
            where: { id: { in: prepRefs } },
            include: { outputItem: { select: { name: true } } },
          })
        : [],
      productionLotIds.length
        ? prisma.prepProductionRun.findMany({ where: { producedLotId: { in: productionLotIds } } })
        : [],
    ])

    const orderItemMap = new Map(orderItems.map((oi) => [oi.id, oi]))
    const poMap = new Map(purchaseOrders.map((po) => [po.id, po]))
    const prepMap = new Map(prepRecipes.map((pr) => [pr.id, pr]))
    const runByLotId = new Map(productionRuns.map((r) => [r.producedLotId, r]))

    const enriched = transactions.map((t) => {
      if (t.source === 'sale' && t.referenceId) {
        const oi = orderItemMap.get(t.referenceId)
        if (oi) {
          return {
            ...t,
            reference: {
              kind: 'order' as const,
              orderId: oi.order.id,
              table: oi.order.table,
              orderStatus: oi.order.status,
              orderCreatedAt: oi.order.createdAt,
              waiterName: oi.order.createdBy.name,
              menuItemName: oi.menuItem.name,
              menuItemVariantLabel: oi.menuItem.variantLabel,
              quantitySold: oi.quantity,
              priceAtSale: oi.priceAtSale,
              costAtSale: oi.costAtSale,
              preparedByName: oi.preparedBy?.name ?? null,
              preparedAt: oi.preparedAt,
              isVoided: oi.isVoided,
              voidReason: oi.voidReason,
            },
          }
        }
      } else if (t.source === 'purchase_order' && t.referenceId) {
        const po = poMap.get(t.referenceId)
        if (po) {
          return {
            ...t,
            reference: {
              kind: 'purchase_order' as const,
              purchaseOrderId: po.id,
              supplierName: po.supplier.name,
              status: po.status,
            },
          }
        }
      } else if (t.source === 'prep_production' && t.referenceId) {
        const pr = prepMap.get(t.referenceId)
        if (pr) {
          const run = runByLotId.get(t.lotId)
          return {
            ...t,
            reference: {
              kind: 'prep_recipe' as const,
              prepRecipeId: pr.id,
              outputItemName: pr.outputItem.name,
              productionSource: run?.source ?? null,
              laborCost: run?.laborCost ?? null,
              outsideCost: run?.outsideCost ?? null,
            },
          }
        }
      }
      return { ...t, reference: null }
    })

    return NextResponse.json(enriched)
  } catch (err) {
    return handleApiError(err)
  }
}
