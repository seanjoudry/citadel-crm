import { z } from 'zod'

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  description: z.string().nullish(),
})

export const updateGroupSchema = createGroupSchema.partial()

export const assignGroupSchema = z.object({
  groupId: z.number().int().positive(),
})
