import type { Request, Response, NextFunction } from 'express'

export class ApiError extends Error {
  status: number

  constructor (status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function errorHandler (err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = (err as ApiError).status || 500
  const message = (err as Error).message || 'Internal Server Error'
  if (status >= 500) console.error(err)
  res.status(status).json({ error: message })
}
