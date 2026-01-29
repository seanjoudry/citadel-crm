import { z } from 'zod'

export const createReminderSchema = z.object({
  remindAt: z.string().datetime().or(z.string().pipe(z.coerce.date().transform(d => d.toISOString()))),
  note: z.string().nullish(),
  completed: z.boolean().default(false),
})

export const updateReminderSchema = createReminderSchema.partial()
