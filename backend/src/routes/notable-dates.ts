import { Router } from 'express'
import prisma from '../config/database.js'
import { validate } from '../middleware/validate.js'
import { createNotableDateSchema, updateNotableDateSchema } from '../validators/notable-dates.schema.js'

const router = Router()

// GET /api/notable-dates/upcoming?days=14
router.get('/upcoming', async (req, res) => {
  const days = parseInt(req.query.days as string, 10) || 14
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentDay = now.getDate()

  // Calculate end date
  const endDate = new Date(now)
  endDate.setDate(endDate.getDate() + days)
  const endMonth = endDate.getMonth() + 1
  const endDay = endDate.getDate()

  // Use raw query for date arithmetic with year-wrap handling
  const notableDates: any[] = await prisma.$queryRawUnsafe(`
    SELECT nd.*, c.first_name, c.last_name
    FROM notable_dates nd
    JOIN contacts c ON c.id = nd.contact_id
    WHERE (nd.recurring = true OR (nd.year IS NOT NULL AND nd.year >= EXTRACT(YEAR FROM CURRENT_DATE)))
    AND (
      CASE
        WHEN ${currentMonth} <= ${endMonth} THEN
          (nd.month > ${currentMonth} OR (nd.month = ${currentMonth} AND nd.day >= ${currentDay}))
          AND (nd.month < ${endMonth} OR (nd.month = ${endMonth} AND nd.day <= ${endDay}))
        ELSE
          (nd.month > ${currentMonth} OR (nd.month = ${currentMonth} AND nd.day >= ${currentDay}))
          OR (nd.month < ${endMonth} OR (nd.month = ${endMonth} AND nd.day <= ${endDay}))
      END
    )
    ORDER BY
      CASE
        WHEN nd.month > ${currentMonth} OR (nd.month = ${currentMonth} AND nd.day >= ${currentDay})
        THEN (nd.month - ${currentMonth}) * 31 + (nd.day - ${currentDay})
        ELSE (nd.month + 12 - ${currentMonth}) * 31 + (nd.day - ${currentDay})
      END
    ASC
  `)

  // Convert BigInt to Number for JSON serialization
  const serialized = notableDates.map((nd) => ({
    ...nd,
    id: Number(nd.id),
    contact_id: Number(nd.contact_id),
    month: Number(nd.month),
    day: Number(nd.day),
    year: nd.year ? Number(nd.year) : null,
  }))

  res.json({ data: serialized })
})

// GET /api/contacts/:contactId/notable-dates
router.get('/contacts/:contactId/notable-dates', async (req, res) => {
  const contactId = parseInt(req.params.contactId, 10)
  const notableDates = await prisma.notableDate.findMany({
    where: { contactId },
    orderBy: [{ month: 'asc' }, { day: 'asc' }],
  })
  res.json({ data: notableDates })
})

// POST /api/contacts/:contactId/notable-dates
router.post(
  '/contacts/:contactId/notable-dates',
  validate(createNotableDateSchema),
  async (req, res) => {
    const contactId = parseInt(req.params.contactId as string, 10)
    const notableDate = await prisma.notableDate.create({
      data: { contactId, ...req.body },
    })
    res.status(201).json({ data: notableDate })
  },
)

// PUT /api/notable-dates/:id
router.put('/:id', validate(updateNotableDateSchema), async (req, res) => {
  const id = parseInt(req.params.id as string, 10)
  const notableDate = await prisma.notableDate.update({
    where: { id },
    data: req.body,
  })
  res.json({ data: notableDate })
})

// DELETE /api/notable-dates/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  await prisma.notableDate.delete({ where: { id } })
  res.json({ data: { deleted: true } })
})

export default router
