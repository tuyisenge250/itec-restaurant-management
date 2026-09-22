import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { updateRoleSchema } from '@/lib/validation/role.schema'
import { updateRole, deleteRole } from '@/lib/services/role.service'
import { handleApiError } from '@/lib/api-error'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('roles.manage')
    const { id } = await params
    const body = updateRoleSchema.parse(await req.json())
    const role = await updateRole({ roleId: id, ...body, userId: user.sub })
    return NextResponse.json(role)
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('roles.manage')
    const { id } = await params
    await deleteRole({ roleId: id, userId: user.sub })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleApiError(err)
  }
}
