import { prisma } from '@/lib/db/prisma'
import type { HomeArea, Role } from '@prisma/client'
import { writeAuditLog } from '@/lib/audit'
import { BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors'
import { isPrivilegedPermissionSet } from '@/lib/permissions'

// Every role query below asks for just the permission keys and flattens the
// result back to a plain string[] — this is the one place that knows
// permissions live on real Permission rows under a Module; every caller of
// these service functions (API routes, the client, the audit log) keeps
// seeing the same { ...role, permissions: string[] } shape as before.
const WITH_PERMISSION_KEYS = { permissions: { select: { key: true } } } as const
type RoleWithPermissionRows = Role & { permissions: { key: string }[] }
function flattenPermissions(role: RoleWithPermissionRows) {
  return { ...role, permissions: role.permissions.map((p) => p.key) }
}

/**
 * Guards against an admin editing a role's permissions down to the point
 * where no active user anywhere can manage roles/users any more — the only
 * hard safety rail in an otherwise fully open permission system, since
 * there's no separate "isSystem" protected role to fall back on. Only
 * blocks when THIS role is losing (or never had) both permissions and no
 * OTHER active user's role would still hold both.
 */
async function assertKeepsRoleManagementReachable(roleId: string, newPermissions: string[]) {
  if (isPrivilegedPermissionSet(newPermissions)) return

  const othersWithBoth = await prisma.user.count({
    where: {
      isActive: true,
      roleId: { not: roleId },
      role: {
        AND: [
          { permissions: { some: { key: 'roles.manage' } } },
          { permissions: { some: { key: 'users.manage' } } },
        ],
      },
    },
  })
  if (othersWithBoth === 0) {
    throw new BusinessRuleError(
      'This change would leave no active user able to manage roles and users — grant those permissions to another role first.',
      'LOCKOUT_PREVENTED'
    )
  }
}

export async function createRole(params: {
  name: string
  homeArea: HomeArea
  maxDiscountPercent: number
  permissions: string[]
  userId: string
}) {
  const { userId, permissions, ...data } = params
  return prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: { ...data, permissions: { connect: permissions.map((key) => ({ key })) } },
      include: WITH_PERMISSION_KEYS,
    })
    const role = flattenPermissions(created)
    await writeAuditLog(tx, { userId, action: 'role.created', entityType: 'Role', entityId: role.id, afterData: role })
    if (isPrivilegedPermissionSet(role.permissions)) {
      await writeAuditLog(tx, {
        userId,
        action: 'role.privilege_escalation',
        entityType: 'Role',
        entityId: role.id,
        afterData: { name: role.name, permissions: role.permissions },
      })
    }
    return role
  })
}

export async function updateRole(params: {
  roleId: string
  name?: string
  homeArea?: HomeArea
  maxDiscountPercent?: number
  permissions?: string[]
  userId: string
}) {
  const { roleId, userId, permissions, ...data } = params

  return prisma.$transaction(async (tx) => {
    const beforeRow = await tx.role.findUnique({ where: { id: roleId }, include: WITH_PERMISSION_KEYS })
    if (!beforeRow) throw new NotFoundError('Role not found')
    const before = flattenPermissions(beforeRow)

    if (permissions !== undefined) {
      await assertKeepsRoleManagementReachable(roleId, permissions)
    }

    const updatedRow = await tx.role.update({
      where: { id: roleId },
      data: { ...data, ...(permissions !== undefined && { permissions: { set: permissions.map((key) => ({ key })) } }) },
      include: WITH_PERMISSION_KEYS,
    })
    const updated = flattenPermissions(updatedRow)
    await writeAuditLog(tx, {
      userId,
      action: 'role.updated',
      entityType: 'Role',
      entityId: roleId,
      beforeData: before,
      afterData: updated,
    })
    // Flag only the transition into privileged status, not every save of a
    // role that already held it — otherwise an unrelated name/discount edit
    // on the Admin role would trip the same alarm every time.
    if (isPrivilegedPermissionSet(updated.permissions) && !isPrivilegedPermissionSet(before.permissions)) {
      await writeAuditLog(tx, {
        userId,
        action: 'role.privilege_escalation',
        entityType: 'Role',
        entityId: roleId,
        beforeData: { name: before.name, permissions: before.permissions },
        afterData: { name: updated.name, permissions: updated.permissions },
      })
    }
    return updated
  })
}

export async function deleteRole(params: { roleId: string; userId: string }) {
  const { roleId, userId } = params

  return prisma.$transaction(async (tx) => {
    const roleRow = await tx.role.findUnique({ where: { id: roleId }, include: WITH_PERMISSION_KEYS })
    if (!roleRow) throw new NotFoundError('Role not found')
    const role = flattenPermissions(roleRow)

    const usersOnRole = await tx.user.count({ where: { roleId } })
    if (usersOnRole > 0) {
      throw new ConflictError(`Cannot delete a role with ${usersOnRole} user(s) still assigned to it — reassign them first`)
    }

    await tx.role.delete({ where: { id: roleId } })
    await writeAuditLog(tx, { userId, action: 'role.deleted', entityType: 'Role', entityId: roleId, beforeData: role })
  })
}
