import { z } from 'zod'

export const createContactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal('')),
  photoUrl: z.string().url().nullish().or(z.literal('')),
  organization: z.string().nullish(),
  title: z.string().nullish(),
  location: z.string().nullish(),
  linkedinUrl: z.string().url().nullish().or(z.literal('')),
  twitterUrl: z.string().url().nullish().or(z.literal('')),
  website: z.string().url().nullish().or(z.literal('')),
  notes: z.string().nullish(),
})

export const updateContactSchema = createContactSchema.partial()
