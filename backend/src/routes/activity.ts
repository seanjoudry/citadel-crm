import { Router } from 'express'
import prisma from '../config/database.js'

const router = Router()

interface DailyCount {
  date: string
  count: bigint
}

// GET /api/contacts/:contactId/activity-heatmap
router.get('/contacts/:contactId/activity-heatmap', async (req, res) => {
  const contactId = parseInt(req.params.contactId, 10)

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 365)

  const result = await prisma.$queryRaw<DailyCount[]>`
    SELECT
      TO_CHAR(occurred_at, 'YYYY-MM-DD') as date,
      COUNT(*) as count
    FROM interactions
    WHERE contact_id = ${contactId}
      AND occurred_at >= ${startDate}
      AND occurred_at <= ${endDate}
    GROUP BY TO_CHAR(occurred_at, 'YYYY-MM-DD')
    ORDER BY date
  `

  // Convert BigInt to number for JSON serialization
  const data = result.map(row => ({
    date: row.date,
    count: Number(row.count),
  }))

  const totalInteractions = data.reduce((sum, d) => sum + d.count, 0)

  res.json({
    data,
    meta: {
      totalInteractions,
      activeDays: data.length,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
  })
})

export default router
