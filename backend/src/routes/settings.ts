import { Router } from 'express'
import prisma from '../config/database.js'

const router = Router()

// GET /api/settings
router.get('/', async (_req, res) => {
  const settings = await prisma.settings.findMany()
  const obj: Record<string, string> = {}
  for (const s of settings) {
    obj[s.key] = s.value
  }
  res.json({ data: obj })
})

// PUT /api/settings/:key
router.put('/:key', async (req, res) => {
  const { key } = req.params
  const { value } = req.body

  if (typeof value !== 'string') {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'value must be a string' },
    })
    return
  }

  const setting = await prisma.settings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
  res.json({ data: setting })
})

export default router
