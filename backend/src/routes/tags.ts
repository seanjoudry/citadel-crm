import { Router } from 'express'
import prisma from '../config/database.js'
import { validate } from '../middleware/validate.js'
import { createTagSchema, updateTagSchema, assignTagSchema } from '../validators/tags.schema.js'

const router = Router()

// GET /api/tags
router.get('/', async (_req, res) => {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { contacts: true } } },
  })
  res.json({ data: tags })
})

// POST /api/tags
router.post('/', validate(createTagSchema), async (req, res) => {
  const tag = await prisma.tag.create({ data: req.body })
  res.status(201).json({ data: tag })
})

// PUT /api/tags/:id
router.put('/:id', validate(updateTagSchema), async (req, res) => {
  const id = parseInt(req.params.id as string, 10)
  const tag = await prisma.tag.update({ where: { id }, data: req.body })
  res.json({ data: tag })
})

// DELETE /api/tags/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  await prisma.tag.delete({ where: { id } })
  res.json({ data: { deleted: true } })
})

// POST /api/contacts/:contactId/tags
router.post(
  '/contacts/:contactId/tags',
  validate(assignTagSchema),
  async (req, res) => {
    const contactId = parseInt(req.params.contactId as string, 10)
    const { tagId } = req.body

    const contactTag = await prisma.contactTag.create({
      data: { contactId, tagId },
      include: { tag: true },
    })
    res.status(201).json({ data: contactTag })
  },
)

// DELETE /api/contacts/:contactId/tags/:tagId
router.delete('/contacts/:contactId/tags/:tagId', async (req, res) => {
  const contactId = parseInt(req.params.contactId, 10)
  const tagId = parseInt(req.params.tagId, 10)

  await prisma.contactTag.delete({
    where: { contactId_tagId: { contactId, tagId } },
  })
  res.json({ data: { deleted: true } })
})

export default router
