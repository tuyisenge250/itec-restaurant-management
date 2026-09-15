export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Not authenticated') {
    super(401, 'UNAUTHENTICATED', message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Not authorized for this action') {
    super(403, 'FORBIDDEN', message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message)
  }
}

// Generic business-rule violation (bad state transition, cap exceeded, etc).
export class BusinessRuleError extends AppError {
  constructor(message: string, code = 'BUSINESS_RULE') {
    super(400, code, message)
  }
}

export class InsufficientStockError extends BusinessRuleError {
  constructor(message: string) {
    super(message, 'INSUFFICIENT_STOCK')
  }
}
