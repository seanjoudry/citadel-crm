import { Router } from 'express'
import multer from 'multer'
import Papa from 'papaparse'
import prisma from '../config/database.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// POST /api/import/contacts
router.post('/contacts', upload.single('file'), async (req, res) => {
  const errors: Array<{ row: number; field: string; message: string }> = []
  let rows: any[] = []

  if (req.file) {
    const text = req.file.buffer.toString('utf-8')
    if (req.file.mimetype === 'application/json' || req.file.originalname.endsWith('.json')) {
      try {
        rows = JSON.parse(text)
      } catch {
        res.status(400).json({
          error: { code: 'INVALID_FILE', message: 'Invalid JSON file' },
        })
        return
      }
    } else {
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      rows = parsed.data as any[]
    }
  } else if (req.body && Array.isArray(req.body)) {
    rows = req.body
  } else {
    res.status(400).json({
      error: { code: 'NO_DATA', message: 'No file or JSON array provided' },
    })
    return
  }

  let imported = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const firstName = row.first_name || row.firstName
    const lastName = row.last_name || row.lastName

    if (!firstName || !lastName) {
      errors.push({ row: i + 1, field: 'name', message: 'first_name and last_name are required' })
      continue
    }

    try {
      await prisma.contact.create({
        data: {
          firstName,
          lastName,
          phone: row.phone || null,
          email: row.email || null,
          photoUrl: row.photo_url || row.photoUrl || null,
          organization: row.organization || null,
          title: row.title || null,
          location: row.location || null,
          linkedinUrl: row.linkedin_url || row.linkedinUrl || null,
          twitterUrl: row.twitter_url || row.twitterUrl || null,
          website: row.website || null,
          notes: row.notes || null,
        },
      })
      imported++
    } catch (err: any) {
      errors.push({ row: i + 1, field: 'unknown', message: err.message })
    }
  }

  res.json({
    data: { imported, skipped: errors.length, errors },
  })
})

// POST /api/import/interactions
router.post('/interactions', upload.single('file'), async (req, res) => {
  const errors: Array<{ row: number; field: string; message: string }> = []
  let rows: any[] = []

  if (req.file) {
    const text = req.file.buffer.toString('utf-8')
    if (req.file.mimetype === 'application/json' || req.file.originalname.endsWith('.json')) {
      try {
        rows = JSON.parse(text)
      } catch {
        res.status(400).json({
          error: { code: 'INVALID_FILE', message: 'Invalid JSON file' },
        })
        return
      }
    } else {
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      rows = parsed.data as any[]
    }
  } else if (req.body && Array.isArray(req.body)) {
    rows = req.body
  } else {
    res.status(400).json({
      error: { code: 'NO_DATA', message: 'No file or JSON array provided' },
    })
    return
  }

  const VALID_TYPES = [
    'CALL_INBOUND', 'CALL_OUTBOUND', 'CALL_MISSED',
    'TEXT_INBOUND', 'TEXT_OUTBOUND',
    'EMAIL_INBOUND', 'EMAIL_OUTBOUND',
    'MEETING', 'MAIL_SENT', 'MAIL_RECEIVED', 'NOTE', 'OTHER',
  ]

  let imported = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const email = row.email || row.contact_email

    if (!email) {
      errors.push({ row: i + 1, field: 'email', message: 'Contact email is required for matching' })
      continue
    }

    const contact = await prisma.contact.findFirst({ where: { email } })
    if (!contact) {
      errors.push({ row: i + 1, field: 'email', message: `No contact found with email: ${email}` })
      continue
    }

    const type = (row.type || '').toUpperCase()
    if (!VALID_TYPES.includes(type)) {
      errors.push({ row: i + 1, field: 'type', message: `Invalid interaction type: ${row.type}` })
      continue
    }

    const occurredAt = row.occurred_at || row.occurredAt
    if (!occurredAt) {
      errors.push({ row: i + 1, field: 'occurred_at', message: 'occurred_at is required' })
      continue
    }

    try {
      await prisma.interaction.create({
        data: {
          contactId: contact.id,
          type: type as any,
          content: row.content || null,
          durationSeconds: row.duration_seconds ? parseInt(row.duration_seconds, 10) : null,
          occurredAt: new Date(occurredAt),
          source: (row.source || 'MANUAL').toUpperCase() as any,
        },
      })
      imported++
    } catch (err: any) {
      errors.push({ row: i + 1, field: 'unknown', message: err.message })
    }
  }

  res.json({
    data: { imported, skipped: errors.length, errors },
  })
})

export default router
