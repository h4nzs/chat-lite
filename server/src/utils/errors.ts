import { Request, Response, NextFunction } from 'express'
import * as Sentry from '@sentry/node';

export class ApiError extends Error {
  status: number

  constructor (status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function errorHandler (err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = typeof err === 'object' && err !== null && 'status' in err ? (err as Record<string, unknown>).status as number : 500
  const message = typeof err === 'object' && err !== null && 'message' in err ? (err as Record<string, unknown>).message as string : 'Internal Server Error'

  // Report 5xx errors to Sentry
  if (status >= 500) {
    if (err instanceof Error) {
      Sentry.captureException(err, {
        level: 'error',
        tags: { http_status: String(status) },
      });
    }
    console.error(err)
  }

  res.status(status).json({ error: message })
}
