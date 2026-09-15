import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError } from '@/lib/errors'

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: err.flatten() },
      { status: 400 }
    )
  }

  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message, code: err.code, details: err.details },
      { status: err.status }
    )
  }

  // Legacy magic-string errors thrown before this file's callers were migrated
  // to AppError subclasses. Kept temporarily so any not-yet-updated code path
  // still degrades to a sane status instead of a 500.
  if (err instanceof Error) {
    if (err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' }, { status: 401 })
    }
    if (err.message === 'FORBIDDEN') {
      return NextResponse.json(
        { error: 'Not authorized for this action', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    return NextResponse.json({ error: err.message, code: 'BUSINESS_RULE' }, { status: 400 })
  }

  return NextResponse.json({ error: 'Unexpected error', code: 'INTERNAL' }, { status: 500 })
}
