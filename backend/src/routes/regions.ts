import { Router } from 'express'
import prisma from '../config/database.js'

const router = Router()

// GET /api/regions
router.get('/', async (_req, res) => {
  const regions = await prisma.region.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { contacts: true } } },
  })
  res.json({ data: regions })
})

// POST /api/regions
router.post('/', async (req, res) => {
  const { name } = req.body
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(422).json({ error: 'Name is required' })
    return
  }
  const region = await prisma.region.create({ data: { name: name.trim() } })
  res.status(201).json({ data: region })
})

// DELETE /api/regions/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  await prisma.region.delete({ where: { id } })
  res.json({ data: { deleted: true } })
})

export default router
