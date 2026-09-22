import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { updateSupplierSchema } from '@/lib/validation/purchase-order.schema'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('suppliers.manage')
    const { id } = await params
    const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id } })
    return NextResponse.json(supplier)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('suppliers.manage')
    const { id } = await params
    const body = updateSupplierSchema.parse(await req.json())
    const supplier = await prisma.supplier.update({ where: { id }, data: body })
    return NextResponse.json(supplier)
  } catch (err) {
    return handleApiError(err)
  }
}

// Soft delete
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('suppliers.manage')
    const { id } = await params
    await prisma.supplier.update({ where: { id }, data: { isActive: false } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
