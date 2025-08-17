export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500
  const message = err.message || 'Internal Server Error'
  if (status >= 500) console.error(err)
  res.status(status).json({ error: message })
}