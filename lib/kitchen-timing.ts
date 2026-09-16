import type { OrderAuditLogEntry } from '@/lib/api/orders'

// Audit log beforeData/afterData are stored as opaque JSON — this just reads
// the one field (status) the kitchen-timing calculation needs out of it.
function statusOf(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'status' in data) {
    const s = (data as { status?: unknown }).status
    return typeof s === 'string' ? s : undefined
  }
  return undefined
}

function msSinceKitchenStart(sentToKitchenAt: string) {
  return Date.now() - new Date(sentToKitchenAt).getTime()
}

export function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

/**
 * Derives "who's cooking this and how long has it taken" for one order.
 * startedAt/startedBy are real columns (set the moment a kitchen user claims
 * the order off the pending queue), so they're used directly rather than
 * dug out of the audit trail; only readyAt still comes from the audit log,
 * since there's no dedicated column for that transition. Shared by the
 * admin order detail dialog, the kitchen board, and the waiter's own order
 * page so all three never drift apart.
 */
export function computeKitchenInfo(
  order: {
    status: string
    startedAt: string | null
    startedBy: { name: string } | null
    items: { preparedBy: { name: string } | null }[]
  } | undefined,
  auditLog: OrderAuditLogEntry[] | undefined
) {
  const preparedByNames = [...new Set(
    [order?.startedBy?.name, ...(order?.items ?? []).map((i) => i.preparedBy?.name)].filter((n): n is string => !!n)
  )]
  const sentToKitchenAt = order?.startedAt ?? undefined
  const readyAt = auditLog?.find(
    (e) => e.action === 'order.status_changed' && statusOf(e.afterData) === 'ready'
  )?.createdAt
  const kitchenDurationMs = sentToKitchenAt && readyAt
    ? new Date(readyAt).getTime() - new Date(sentToKitchenAt).getTime()
    : null
  const stillInKitchen = order?.status === 'preparing' && sentToKitchenAt
  const inProgressMs = stillInKitchen ? msSinceKitchenStart(sentToKitchenAt!) : null

  return { preparedByNames, sentToKitchenAt, readyAt, kitchenDurationMs, inProgressMs }
}
