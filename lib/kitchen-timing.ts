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
 * the order's prep items off the pending queue), so they're used directly.
 * readyAt is derived from the prep items themselves — each one's preparedAt
 * is set the moment it's individually marked ready — as the latest of those,
 * once every (non-voided) prep item has one; there's no order-level "ready"
 * write anymore since that status is now purely computed from item statuses
 * (see computeOrderStatus). Shared by the admin order detail dialog, the
 * kitchen board, and the waiter's own order page so all three never drift
 * apart.
 */
export function computeKitchenInfo(
  order: {
    status: string
    startedAt: string | null
    startedBy: { name: string } | null
    items: { requiresPreparation: boolean; status: string; preparedBy: { name: string } | null; preparedAt: string | null }[]
  } | undefined
) {
  const preparedByNames = [...new Set(
    [order?.startedBy?.name, ...(order?.items ?? []).map((i) => i.preparedBy?.name)].filter((n): n is string => !!n)
  )]
  const sentToKitchenAt = order?.startedAt ?? undefined

  const prepItems = (order?.items ?? []).filter((i) => i.requiresPreparation && i.status !== 'voided')
  const kitchenFullyDone = prepItems.length > 0 && prepItems.every((i) => i.preparedAt)
  const readyAt = kitchenFullyDone
    ? prepItems.reduce<string | undefined>((latest, i) => (!latest || i.preparedAt! > latest ? i.preparedAt! : latest), undefined)
    : undefined

  const kitchenDurationMs = sentToKitchenAt && readyAt
    ? new Date(readyAt).getTime() - new Date(sentToKitchenAt).getTime()
    : null
  const stillInKitchen = order?.status === 'preparing' && sentToKitchenAt
  const inProgressMs = stillInKitchen ? msSinceKitchenStart(sentToKitchenAt!) : null

  return { preparedByNames, sentToKitchenAt, readyAt, kitchenDurationMs, inProgressMs }
}
