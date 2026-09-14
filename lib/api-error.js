import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid input', details: err.flatten() }, { status: 400 })
  }

  if (err instanceof Error) {
    if (err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Not authorized for this action' }, { status: 403 })
    }
    // Business-rule errors thrown by the services layer (e.g. "Insufficient stock for Cheese")
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
}