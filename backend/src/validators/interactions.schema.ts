import { z } from 'zod'

const interactionTypes = [
  'CALL_INBOUND', 'CALL_OUTBOUND', 'CALL_MISSED',
  'TEXT_INBOUND', 'TEXT_OUTBOUND',
  'EMAIL_INBOUND', 'EMAIL_OUTBOUND',
  'MEETING', 'MAIL_SENT', 'MAIL_RECEIVED', 'NOTE', 'OTHER',
] as const

const interactionSources = [
  'MANUAL', 'IMPORT_IOS', 'IMPORT_ANDROID', 'IMPORT_EMAIL', 'API',
] as const

export const createInteractionSchema = z.object({
  type: z.enum(interactionTypes),
  content: z.string().nullish(),
  durationSeconds: z.number().int().positive().nullish(),
  occurredAt: z.string().datetime().or(z.coerce.date().transform(d => d.toISOString())),
  source: z.enum(interactionSources).default('MANUAL'),
})

export const updateInteractionSchema = createInteractionSchema.partial()
