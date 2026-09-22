import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { createSupplierSchema } from '@/lib/validation/purchase-order.schema'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
    await requirePermission('suppliers.manage')
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(suppliers)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission('suppliers.manage')
    const body = createSupplierSchema.parse(await req.json())
    const supplier = await prisma.supplier.create({ data: body })
    return NextResponse.json(supplier, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}