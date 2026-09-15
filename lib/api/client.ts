export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error ?? 'Request failed', body.code, body.details)
  }
  return res.json()
}

