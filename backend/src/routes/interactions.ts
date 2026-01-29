import { Router } from 'express'
import prisma from '../config/database.js'
import { validate } from '../middleware/validate.js'
import { createInteractionSchema, updateInteractionSchema } from '../validators/interactions.schema.js'

const router = Router()

const OUTBOUND_TYPES = [
  'CALL_OUTBOUND', 'TEXT_OUTBOUND', 'EMAIL_OUTBOUND', 'MEETING', 'MAIL_SENT',
]

// GET /api/contacts/:contactId/interactions
router.get('/contacts/:contactId/interactions', async (req, res) => {
  const contactId = parseInt(req.params.contactId, 10)
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20))
  const skip = (page - 1) * limit

  const [interactions, total] = await Promise.all([
    prisma.interaction.findMany({
      where: { contactId },
      orderBy: { occurredAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.interaction.count({ where: { contactId } }),
  ])

  res.json({
    data: interactions,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

// POST /api/contacts/:contactId/interactions
router.post(
  '/contacts/:contactId/interactions',
  validate(createInteractionSchema),
  async (req, res) => {
    const contactId = parseInt(req.params.contactId, 10)

    const contact = await prisma.contact.findUnique({ where: { id: contactId } })
    if (!contact) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Contact not found' },
      })
      return
    }

    const interaction = await prisma.interaction.create({
      data: {
        contactId,
        type: req.body.type,
        content: req.body.content ?? null,
        durationSeconds: req.body.durationSeconds ?? null,
        occurredAt: new Date(req.body.occurredAt),
        source: req.body.source,
      },
    })

    // Update lastContactedAt if this is an outbound interaction
    if (OUTBOUND_TYPES.includes(req.body.type)) {
      const occurredAt = new Date(req.body.occurredAt)
      if (!contact.lastContactedAt || occurredAt > contact.lastContactedAt) {
        await prisma.contact.update({
          where: { id: contactId },
          data: { lastContactedAt: occurredAt },
        })
      }
    }

    res.status(201).json({ data: interaction })
  },
)

// PUT /api/interactions/:id
router.put('/interactions/:id', validate(updateInteractionSchema), async (req, res) => {
  const id = parseInt(req.params.id, 10)

  const existing = await prisma.interaction.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Interaction not found' },
    })
    return
  }

  const data: any = { ...req.body }
  if (data.occurredAt) data.occurredAt = new Date(data.occurredAt)

  const interaction = await prisma.interaction.update({
    where: { id },
    data,
  })

  // Recalculate lastContactedAt for the contact
  await recalculateLastContacted(existing.contactId)

  res.json({ data: interaction })
})

// DELETE /api/interactions/:id
router.delete('/interactions/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)

  const existing = await prisma.interaction.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Interaction not found' },
    })
    return
  }

  await prisma.interaction.delete({ where: { id } })
  await recalculateLastContacted(existing.contactId)

  res.json({ data: { deleted: true } })
})

async function recalculateLastContacted(contactId: number) {
  const latest = await prisma.interaction.findFirst({
    where: {
      contactId,
      type: { in: OUTBOUND_TYPES as any },
    },
    orderBy: { occurredAt: 'desc' },
  })

  await prisma.contact.update({
    where: { id: contactId },
    data: { lastContactedAt: latest?.occurredAt ?? null },
  })
}

export default router
