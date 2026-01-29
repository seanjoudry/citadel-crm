import { Router } from 'express'
import prisma from '../config/database.js'
import { validate } from '../middleware/validate.js'
import { createGroupSchema, updateGroupSchema, assignGroupSchema } from '../validators/groups.schema.js'

const router = Router()

// GET /api/groups
router.get('/', async (_req, res) => {
  const groups = await prisma.group.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { contacts: true } } },
  })
  res.json({ data: groups })
})

// POST /api/groups
router.post('/', validate(createGroupSchema), async (req, res) => {
  const group = await prisma.group.create({ data: req.body })
  res.status(201).json({ data: group })
})

// PUT /api/groups/:id
router.put('/:id', validate(updateGroupSchema), async (req, res) => {
  const id = parseInt(req.params.id as string, 10)
  const group = await prisma.group.update({ where: { id }, data: req.body })
  res.json({ data: group })
})

// DELETE /api/groups/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  await prisma.group.delete({ where: { id } })
  res.json({ data: { deleted: true } })
})

// POST /api/contacts/:contactId/groups
router.post(
  '/contacts/:contactId/groups',
  validate(assignGroupSchema),
  async (req, res) => {
    const contactId = parseInt(req.params.contactId as string, 10)
    const { groupId } = req.body

    const contactGroup = await prisma.contactGroup.create({
      data: { contactId, groupId },
      include: { group: true },
    })
    res.status(201).json({ data: contactGroup })
  },
)

// DELETE /api/contacts/:contactId/groups/:groupId
router.delete('/contacts/:contactId/groups/:groupId', async (req, res) => {
  const contactId = parseInt(req.params.contactId, 10)
  const groupId = parseInt(req.params.groupId, 10)

  await prisma.contactGroup.delete({
    where: { contactId_groupId: { contactId, groupId } },
  })
  res.json({ data: { deleted: true } })
})

export default router
