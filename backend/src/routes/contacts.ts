import { Router } from 'express'
import prisma from '../config/database.js'
import { validate } from '../middleware/validate.js'
import { createContactSchema, updateContactSchema } from '../validators/contacts.schema.js'
import { CADENCE_DAYS } from '../constants/cadence.js'

const router = Router()

const OUTBOUND_TYPES = [
  'CALL_OUTBOUND', 'TEXT_OUTBOUND', 'EMAIL_OUTBOUND', 'MEETING', 'MAIL_SENT',
]

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function calculateContactDueAt(
  cadence: string | null | undefined,
  lastContactedAt: Date | null,
): Date | null {
  if (!cadence) return null
  const days = CADENCE_DAYS[cadence]
  const baseDate = lastContactedAt || new Date()
  return addDays(baseDate, days)
}

// GET /api/contacts
router.get('/', async (req, res) => {
  const {
    search,
    tagIds,
    groupId,
    sort = 'name_asc',
    needsAttention,
    page = '1',
    limit = '25',
  } = req.query as Record<string, string>

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25))
  const skip = (pageNum - 1) * limitNum

  // Build where clause
  const where: any = {}

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { organization: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (tagIds) {
    const ids = tagIds.split(',').map(Number).filter(Boolean)
    if (ids.length > 0) {
      where.AND = ids.map((tagId) => ({
        tags: { some: { tagId } },
      }))
    }
  }

  if (groupId) {
    const gid = parseInt(groupId, 10)
    if (gid) {
      where.groups = { some: { groupId: gid } }
    }
  }

  if (needsAttention === 'true') {
    const settings = await prisma.settings.findUnique({
      where: { key: 'attention_threshold_days' },
    })
    const threshold = parseInt(settings?.value || '30', 10)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - threshold)

    where.OR = [
      ...(where.OR || []),
      { lastContactedAt: { lt: cutoff } },
      { lastContactedAt: null },
    ]
    // If we already had an OR from search, we need to restructure
    if (search) {
      const searchOr = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { organization: { contains: search, mode: 'insensitive' } },
      ]
      where.AND = [
        ...(where.AND || []),
        { OR: searchOr },
        { OR: [{ lastContactedAt: { lt: cutoff } }, { lastContactedAt: null }] },
      ]
      delete where.OR
    }
  }

  // Build orderBy
  let orderBy: any
  switch (sort) {
    case 'name_desc':
      orderBy = [{ lastName: 'desc' }, { firstName: 'desc' }]
      break
    case 'created_desc':
      orderBy = { createdAt: 'desc' }
      break
    case 'last_contacted_asc':
      orderBy = { lastContactedAt: { sort: 'asc', nulls: 'first' } }
      break
    case 'last_contacted_desc':
      orderBy = { lastContactedAt: { sort: 'desc', nulls: 'last' } }
      break
    default:
      orderBy = [{ lastName: 'asc' }, { firstName: 'asc' }]
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      include: {
        tags: { include: { tag: true } },
        groups: { include: { group: true } },
        notableDates: true,
        region: true,
      },
    }),
    prisma.contact.count({ where }),
  ])

  res.json({
    data: contacts,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  })
})

// GET /api/contacts/:id
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id as string, 10)
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      groups: { include: { group: true } },
      notableDates: true,
      reminders: { orderBy: { remindAt: 'asc' } },
      region: true,
    },
  })

  if (!contact) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Contact not found' },
    })
    return
  }

  res.json({ data: contact })
})

// POST /api/contacts
router.post('/', validate(createContactSchema), async (req, res) => {
  const contactDueAt = calculateContactDueAt(req.body.cadence, null)

  const contact = await prisma.contact.create({
    data: {
      ...req.body,
      email: req.body.email || null,
      photoUrl: req.body.photoUrl || null,
      linkedinUrl: req.body.linkedinUrl || null,
      twitterUrl: req.body.twitterUrl || null,
      website: req.body.website || null,
      contactDueAt,
    },
    include: {
      tags: { include: { tag: true } },
      groups: { include: { group: true } },
      region: true,
    },
  })
  res.status(201).json({ data: contact })
})

// PUT /api/contacts/:id
router.put('/:id', validate(updateContactSchema), async (req, res) => {
  const id = parseInt(req.params.id as string, 10)

  const existing = await prisma.contact.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Contact not found' },
    })
    return
  }

  const data: any = { ...req.body }
  // Convert empty strings to null for URL fields
  for (const field of ['email', 'photoUrl', 'linkedinUrl', 'twitterUrl', 'website']) {
    if (data[field] === '') data[field] = null
  }

  // If cadence is being updated, recalculate contactDueAt
  if ('cadence' in req.body) {
    // Need to find most recent interaction (any type) to calculate due date
    const mostRecentInteraction = await prisma.interaction.findFirst({
      where: { contactId: id },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    })
    data.contactDueAt = calculateContactDueAt(
      req.body.cadence,
      mostRecentInteraction?.occurredAt || existing.lastContactedAt,
    )
  }

  const contact = await prisma.contact.update({
    where: { id },
    data,
    include: {
      tags: { include: { tag: true } },
      groups: { include: { group: true } },
      region: true,
    },
  })
  res.json({ data: contact })
})

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id as string, 10)

  const existing = await prisma.contact.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Contact not found' },
    })
    return
  }

  await prisma.contact.delete({ where: { id } })
  res.json({ data: { deleted: true } })
})

export default router
