import { BusinessRuleError } from '@/lib/errors'
import { parseUpperBoundDate } from '@/lib/date-range'

const MAX_RANGE_DAYS = 366
const MAX_RANGE_MS = MAX_RANGE_DAYS * 24 * 60 * 60 * 1000

// Every report keys off Payment.createdAt (revenue is recognized when
// paid), applied consistently, with a bounded range so a bad request can't
// force a full-table scan.
export function parseReportDateRange(searchParams: URLSearchParams) {
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const from = fromParam ? new Date(fromParam) : new Date(new Date().setHours(0, 0, 0, 0))
  const to = toParam ? parseUpperBoundDate(toParam) : new Date()

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BusinessRuleError('Invalid date range')
  }
  if (to < from) {
    throw new BusinessRuleError('`to` must not be before `from`')
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new BusinessRuleError(`Date range cannot exceed ${MAX_RANGE_DAYS} days`)
  }

  return { from, to }
}
