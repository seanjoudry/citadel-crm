import { Router } from 'express'
import prisma from '../config/database.js'

const router = Router()

// GET /api/dashboard
router.get('/', async (_req, res) => {
  const settings = await prisma.settings.findUnique({
    where: { key: 'attention_threshold_days' },
  })
  const threshold = parseInt(settings?.value || '30', 10)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - threshold)

  const now = new Date()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date()
  monthAgo.setMonth(monthAgo.getMonth() - 1)

  const [
    needsAttention,
    upcomingReminders,
    recentActivity,
    totalContacts,
    interactionsThisWeek,
    interactionsThisMonth,
  ] = await Promise.all([
    // Contacts needing attention
    prisma.contact.findMany({
      where: {
        OR: [
          { lastContactedAt: { lt: cutoff } },
          { lastContactedAt: null },
        ],
      },
      orderBy: { lastContactedAt: { sort: 'asc', nulls: 'first' } },
      take: 10,
      include: {
        tags: { include: { tag: true } },
      },
    }),

    // Upcoming reminders (not completed)
    prisma.reminder.findMany({
      where: { completed: false },
      orderBy: { remindAt: 'asc' },
      take: 10,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    }),

    // Recent activity
    prisma.interaction.findMany({
      orderBy: { occurredAt: 'desc' },
      take: 20,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    }),

    // Stats
    prisma.contact.count(),
    prisma.interaction.count({ where: { occurredAt: { gte: weekAgo } } }),
    prisma.interaction.count({ where: { occurredAt: { gte: monthAgo } } }),
  ])

  // Upcoming notable dates (next 14 days) - using raw query for date arithmetic
  const currentMonth = now.getMonth() + 1
  const currentDay = now.getDate()
  const endDate = new Date(now)
  endDate.setDate(endDate.getDate() + 14)
  const endMonth = endDate.getMonth() + 1
  const endDay = endDate.getDate()

  let upcomingDates: any[] = []
  try {
    upcomingDates = await prisma.$queryRawUnsafe(`
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
      LIMIT 10
    `)
    upcomingDates = upcomingDates.map((nd) => ({
      ...nd,
      id: Number(nd.id),
      contact_id: Number(nd.contact_id),
      month: Number(nd.month),
      day: Number(nd.day),
      year: nd.year ? Number(nd.year) : null,
    }))
  } catch {
    // Fall back to empty if query fails
  }

  res.json({
    data: {
      needsAttention,
      upcomingReminders,
      upcomingDates,
      recentActivity,
      stats: {
        totalContacts,
        interactionsThisWeek,
        interactionsThisMonth,
      },
    },
  })
})

export default router
