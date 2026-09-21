import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireRole } from '@/lib/auth/session'
import { writeAuditLog } from '@/lib/audit'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'kitchen', 'waiter', 'cashier']).optional(),
  isActive: z.boolean().optional(),
})

const select = { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, select })
    return NextResponse.json(user)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    const { password, ...rest } = updateUserSchema.parse(await req.json())
    const data: Record<string, unknown> = { ...rest }
    if (password) data.passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.update({ where: { id }, data, select })
    return NextResponse.json(user)
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
    const admin = await requireRole('admin')
    const { id } = await params

    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: { isActive: false }, select })
      await writeAuditLog(tx, {
        userId: admin.sub,
        action: 'user.deactivated',
        entityType: 'User',
        entityId: id,
        afterData: updated,
      })
    })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
