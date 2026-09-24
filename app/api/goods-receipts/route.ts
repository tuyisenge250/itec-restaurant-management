import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { listGoodsReceipts } from '@/lib/services/goods-receipt.service'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
    await requirePermission('goods_receipts.view', 'purchase_orders.manage')
    const goodsReceipts = await listGoodsReceipts()
    return NextResponse.json(goodsReceipts)
  } catch (err) {
    return handleApiError(err)
  }
}
