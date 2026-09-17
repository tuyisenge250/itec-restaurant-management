const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// A bare "YYYY-MM-DD" value parses as UTC midnight — the very start of that
// day — so using it as-is for an inclusive upper bound silently excludes the
// entire day it names (e.g. "up to today" would match zero of today's rows).
// Push date-only values to the last instant of that day; a full timestamp is
// left untouched.
export function parseUpperBoundDate(raw: string): Date {
  const d = new Date(raw)
  if (DATE_ONLY.test(raw)) d.setUTCHours(23, 59, 59, 999)
  return d
}
