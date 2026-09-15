import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

export type AuditLogEntry = {
  id: string
  userId: string | null
  user: { name: string } | null
  action: string
  entityType: string
  entityId: string
  beforeData: unknown
  afterData: unknown
  createdAt: string
}
export type AuditLogPage = { entries: AuditLogEntry[]; total: number; page: number; pageSize: number }
export type AuditLogFilters = { entityType?: string; userId?: string; from?: string; to?: string; page?: number }

export const getAuditLog = (filters: AuditLogFilters) => {
  const entries = Object.entries(filters)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, String(v)] as [string, string])
  const qs = new URLSearchParams(entries).toString()
  return apiFetch<AuditLogPage>(`/api/audit-log${qs ? `?${qs}` : ''}`)
}

export function useAuditLog(filters: AuditLogFilters) {
  return useQuery({ queryKey: ['audit-log', filters], queryFn: () => getAuditLog(filters) })
}
