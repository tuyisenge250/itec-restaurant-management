import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'
import { BusinessRuleError } from '@/lib/errors'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  try {
    await requireRole('admin')
    const { searchParams } = req.nextUrl
    const entityType = searchParams.get('entityType') ?? undefined
    const userId = searchParams.get('userId') ?? undefined
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
    if (!Number.isFinite(page)) throw new BusinessRuleError('Invalid page number')

    const where = {
      entityType,
      userId,
      createdAt: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    }

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({ entries, total, page, pageSize: PAGE_SIZE })
  } catch (err) {
    return handleApiError(err)
  }
}
