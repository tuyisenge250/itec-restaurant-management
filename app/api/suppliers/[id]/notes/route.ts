import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { createSupplierNoteSchema } from '@/lib/validation/purchase-order.schema'
import { addSupplierNote } from '@/lib/services/purchase-order.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('admin')
    const { id } = await params
    const notes = await prisma.supplierNote.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { name: true } } },
    })
    return NextResponse.json(notes)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('admin')
    const { id } = await params
    const body = createSupplierNoteSchema.parse(await req.json())
    const note = await addSupplierNote({ supplierId: id, ...body, authorId: user.sub })
    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
