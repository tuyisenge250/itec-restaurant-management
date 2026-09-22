import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { createRoleSchema } from '@/lib/validation/role.schema'
import { createRole } from '@/lib/services/role.service'
import { prisma } from '@/lib/db/prisma'
import { handleApiError } from '@/lib/api-error'

// Readable by anyone who can manage roles OR manage users — the user
// create/edit dialog needs this list to populate its role picker even for a
// role that can create staff accounts but was never itself given
// roles.manage.
export async function GET() {
  try {
    await requirePermission('roles.manage', 'users.manage')
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(roles)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('roles.manage')
    const body = createRoleSchema.parse(await req.json())
    const role = await createRole({ ...body, userId: user.sub })
    return NextResponse.json(role, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
