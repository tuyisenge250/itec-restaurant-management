import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/audit'
import { BusinessRuleError, NotFoundError } from '@/lib/errors'

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
  role: { select: { id: true, name: true, homeArea: true } },
} as const

/**
 * The user-side counterpart to role.service.ts's
 * assertKeepsRoleManagementReachable: that one guards editing a role's
 * permissions down, this one guards deactivating or reassigning a *user*
 * away from a role that holds roles.manage + users.manage. Same safety net,
 * different way to fall through it — deactivate the last admin, or just
 * quietly move them to a lesser role, and the system is equally locked out.
 * Only relevant when this user currently holds both permissions; otherwise
 * they were never part of the last line of defense.
 */
async function assertUserChangeKeepsRoleManagementReachable(params: {
  userId: string
  nextIsActive: boolean
  nextRoleId?: string
}) {
  const { userId, nextIsActive, nextRoleId } = params

  const current = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } })
  if (!current) throw new NotFoundError('User not found')

  const currentlyHoldsBoth = current.role.permissions.includes('roles.manage') && current.role.permissions.includes('users.manage')
  if (!currentlyHoldsBoth) return

  let stillHoldsBoth = nextIsActive
  if (stillHoldsBoth && nextRoleId && nextRoleId !== current.roleId) {
    const nextRole = await prisma.role.findUnique({ where: { id: nextRoleId } })
    stillHoldsBoth = !!nextRole && nextRole.permissions.includes('roles.manage') && nextRole.permissions.includes('users.manage')
  }
  if (stillHoldsBoth) return

  const othersWithBoth = await prisma.user.count({
    where: {
      isActive: true,
      id: { not: userId },
      role: { permissions: { hasEvery: ['roles.manage', 'users.manage'] } },
    },
  })
  if (othersWithBoth === 0) {
    throw new BusinessRuleError(
      'This would leave no active user able to manage roles and users — promote another user first.',
      'LOCKOUT_PREVENTED'
    )
  }
}

export async function createUser(params: {
  name: string
  email: string
  password: string
  roleId: string
  actorId: string
}) {
  const { password, actorId, ...rest } = params
  const passwordHash = await bcrypt.hash(password, 10)

  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { ...rest, passwordHash }, select: USER_SELECT })
    await writeAuditLog(tx, { userId: actorId, action: 'user.created', entityType: 'User', entityId: created.id, afterData: created })
    return created
  })
}

export async function updateUser(params: {
  userId: string
  data: { name?: string; email?: string; password?: string; roleId?: string; isActive?: boolean }
  actorId: string
}) {
  const { userId, data, actorId } = params

  if (data.isActive === false || data.roleId !== undefined) {
    await assertUserChangeKeepsRoleManagementReachable({
      userId,
      nextIsActive: data.isActive ?? true,
      nextRoleId: data.roleId,
    })
  }

  const { password, ...rest } = data
  const updateData: Record<string, unknown> = { ...rest }
  if (password) updateData.passwordHash = await bcrypt.hash(password, 10)

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: userId }, select: USER_SELECT })
    if (!before) throw new NotFoundError('User not found')
    const updated = await tx.user.update({ where: { id: userId }, data: updateData, select: USER_SELECT })
    await writeAuditLog(tx, {
      userId: actorId,
      action: 'user.updated',
      entityType: 'User',
      entityId: userId,
      beforeData: before,
      afterData: updated,
    })
    return updated
  })
}

/** Soft delete — deactivation is the only kind this app does, same as InventoryItem/Supplier. */
export async function deactivateUser(params: { userId: string; actorId: string }) {
  const { userId, actorId } = params
  await assertUserChangeKeepsRoleManagementReachable({ userId, nextIsActive: false })

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: userId }, data: { isActive: false }, select: USER_SELECT })
    await writeAuditLog(tx, { userId: actorId, action: 'user.deactivated', entityType: 'User', entityId: userId, afterData: updated })
    return updated
  })
}
