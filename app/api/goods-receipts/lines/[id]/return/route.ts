import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { recordGoodsReturnSchema } from '@/lib/validation/goods-receipt.schema'
import { recordGoodsReturn } from '@/lib/services/goods-receipt.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('goods_receipts.return', 'purchase_orders.manage')
    const { id } = await params
    const body = recordGoodsReturnSchema.parse(await req.json())
    const goodsReturn = await recordGoodsReturn({ goodsReceiptLineId: id, ...body, actorId: user.sub })
    return NextResponse.json(goodsReturn, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
