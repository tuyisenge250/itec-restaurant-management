import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requirePermission } from '@/lib/auth/session'
import { writeAuditLog } from '@/lib/audit'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  roleId: z.string().min(1),
})

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
  role: { select: { id: true, name: true, homeArea: true } },
} as const

export async function GET() {
  try {
    // Cashier gets read access to the staff list too — its oversight
    // dashboard filters orders by waiter, same as admin's does. Creating,
    // editing, or deactivating an account stays admin-only below.
    await requirePermission('users.view')
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: USER_SELECT,
    })
    return NextResponse.json(users)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission('users.manage')
    const { password, ...rest } = createUserSchema.parse(await req.json())
    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { ...rest, passwordHash },
        select: USER_SELECT,
      })
      await writeAuditLog(tx, {
        userId: admin.sub,
        action: 'user.created',
        entityType: 'User',
        entityId: created.id,
        afterData: created,
      })
      return created
    })

    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
