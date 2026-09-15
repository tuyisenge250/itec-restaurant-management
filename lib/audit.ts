import type { Prisma } from '@prisma/client'

type TxClient = Prisma.TransactionClient

// Every sensitive action (PO approval/cancellation, goods receipt, manual stock
// adjustment, order item void, discount, refund, user create/deactivate,
// price/recipe edits) writes one of these inside the SAME transaction as the
// change it's logging, using the actual before/after row state.
export async function writeAuditLog(
  tx: TxClient,
  params: {
    userId: string | null
    action: string
    entityType: string
    entityId: string
    beforeData?: unknown
    afterData?: unknown
  }
) {
  const { userId, action, entityType, entityId, beforeData, afterData } = params
  await tx.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      beforeData: beforeData === undefined ? undefined : (beforeData as Prisma.InputJsonValue),
      afterData: afterData === undefined ? undefined : (afterData as Prisma.InputJsonValue),
    },
  })
}
