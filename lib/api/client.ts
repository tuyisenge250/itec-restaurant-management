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

// The access-token cookie expires after 15 minutes (see /api/auth/login),
// but nothing ever called /api/auth/refresh — a user who was simply reading
// the screen for that long would hit a raw 401 "Not authenticated" on their
// very next action, even though they never logged out. De-duped so several
// requests hitting 401 at once don't each race their own refresh call.
let refreshPromise: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const doFetch = () =>
    fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })

  let res = await doFetch()

  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshed = await refreshSession()
    if (refreshed) {
      res = await doFetch()
    } else if (typeof window !== 'undefined') {
      // apiFetch is a plain module function, not a component/event handler,
      // so useRouter() isn't available here — a full navigation is also
      // what we want anyway, since it drops any stale in-memory state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error ?? 'Request failed', body.code, body.details)
  }
  // Some routes (deletes, the adjust/waste actions) succeed with an empty
  // body (201/204 + null) — res.json() throws on that even though the
  // request worked, so only parse when there's actually something to parse.
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

