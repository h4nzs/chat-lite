import { ZodError } from 'zod'
import { ApiError } from './errors.js'

export function zodValidate (schema) {
  return (req, _res, next) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body)
      if (schema.query) req.query = schema.query.parse(req.query)
      if (schema.params) req.params = schema.params.parse(req.params)
      next()
    } catch (e) {
      if (e instanceof ZodError) {
        const msg = e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
        next(new ApiError(400, msg))
      } else next(e)
    }
  }
}
