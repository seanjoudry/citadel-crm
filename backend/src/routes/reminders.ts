import { Router } from 'express'
import prisma from '../config/database.js'
import { validate } from '../middleware/validate.js'
import { createReminderSchema, updateReminderSchema } from '../validators/reminders.schema.js'

const router = Router()

// GET /api/reminders (upcoming + overdue, not completed)
router.get('/', async (_req, res) => {
  const reminders = await prisma.reminder.findMany({
    where: { completed: false },
    orderBy: { remindAt: 'asc' },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  })
  res.json({ data: reminders })
})

// GET /api/contacts/:contactId/reminders
router.get('/contacts/:contactId/reminders', async (req, res) => {
  const contactId = parseInt(req.params.contactId, 10)
  const reminders = await prisma.reminder.findMany({
    where: { contactId },
    orderBy: { remindAt: 'asc' },
  })
  res.json({ data: reminders })
})

// POST /api/contacts/:contactId/reminders
router.post(
  '/contacts/:contactId/reminders',
  validate(createReminderSchema),
  async (req, res) => {
    const contactId = parseInt(req.params.contactId as string, 10)
    const reminder = await prisma.reminder.create({
      data: {
        contactId,
        remindAt: new Date(req.body.remindAt),
        note: req.body.note ?? null,
        completed: req.body.completed,
      },
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    })
    res.status(201).json({ data: reminder })
  },
)

// PUT /api/reminders/:id
router.put('/:id', validate(updateReminderSchema), async (req, res) => {
  const id = parseInt(req.params.id as string, 10)
  const data: any = { ...req.body }
  if (data.remindAt) data.remindAt = new Date(data.remindAt)

  const reminder = await prisma.reminder.update({
    where: { id },
    data,
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  })
  res.json({ data: reminder })
})

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  await prisma.reminder.delete({ where: { id } })
  res.json({ data: { deleted: true } })
})

export default router
