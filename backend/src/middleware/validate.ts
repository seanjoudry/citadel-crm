import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

export function validate(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const details: Record<string, string[]> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.')
        if (!details[key]) details[key] = []
        details[key].push(issue.message)
      }
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details,
        },
      })
      return
    }
    req.body = result.data
    next()
  }
}
