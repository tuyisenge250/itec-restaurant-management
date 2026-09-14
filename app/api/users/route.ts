import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'kitchen', 'waiter']),
})

export async function GET() {
  try {
    await requireRole('admin')
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    })
    return NextResponse.json(users)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('admin')
    const { password, ...rest } = createUserSchema.parse(await req.json())
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { ...rest, passwordHash },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    })
    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
