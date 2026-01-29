import { z } from 'zod'

export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color').default('#6366f1'),
})

export const updateTagSchema = createTagSchema.partial()

export const assignTagSchema = z.object({
  tagId: z.number().int().positive(),
})
