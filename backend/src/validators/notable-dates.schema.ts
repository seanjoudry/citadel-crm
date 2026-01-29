import { z } from 'zod'

const notableDateTypes = [
  'BIRTHDAY', 'ANNIVERSARY', 'FIRST_MET', 'ELECTION', 'CUSTOM',
] as const

export const createNotableDateSchema = z.object({
  type: z.enum(notableDateTypes),
  label: z.string().nullish(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  year: z.number().int().min(1900).max(2100).nullish(),
  recurring: z.boolean().default(true),
  notes: z.string().nullish(),
})

export const updateNotableDateSchema = createNotableDateSchema.partial()
