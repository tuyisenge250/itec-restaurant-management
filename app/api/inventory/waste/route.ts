import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { logWasteSchema } from '@/lib/validation/payment.schema'
import { logWaste } from '@/lib/services/inventory.service'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    if (user.role !== 'kitchen' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized for this action' }, { status: 403 })
    }

    const body = logWasteSchema.parse(await req.json())
    const item = await logWaste({ ...body, recordedById: user.sub })

    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}