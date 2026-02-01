import { Router } from 'express'
import multer from 'multer'
import Papa from 'papaparse'
import AdmZip from 'adm-zip'
import Database from 'better-sqlite3'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtempSync, rmSync, readdirSync, existsSync, readFileSync } from 'fs'
import prisma from '../config/database.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * 1024 * 1024 } }) // 150MB for .abbu files

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

// POST /api/import/abbu - Import from Apple Address Book backup (.abbu)
router.post('/abbu', upload.single('file'), async (req, res) => {
  if (!req.file || !req.file.originalname.endsWith('.abbu')) {
    res.status(400).json({
      error: { code: 'INVALID_FILE', message: 'Please upload a .abbu file' },
    })
    return
  }

  const errors: Array<{ contact: string; message: string }> = []
  let imported = 0
  let skippedNoPhone = 0
  let skippedGmail = 0
  let tempDir: string | null = null

  try {
    // Extract .abbu file to temp directory
    tempDir = mkdtempSync(join(tmpdir(), 'abbu-'))
    const zip = new AdmZip(req.file.buffer)
    zip.extractAllTo(tempDir, true)

    // Find Sources directory
    const sourcesDir = findSourcesDir(tempDir)
    if (!sourcesDir) {
      res.status(400).json({
        error: { code: 'INVALID_ABBU', message: 'Could not find Sources directory in .abbu file' },
      })
      return
    }

    // Process each source directory
    const sources = readdirSync(sourcesDir)
    for (const sourceId of sources) {
      const sourcePath = join(sourcesDir, sourceId)

      // Check if this is an iCloud source (skip Gmail, Exchange, etc.)
      const sourceType = getSourceType(sourcePath)
      if (sourceType === 'gmail' || sourceType === 'exchange') {
        skippedGmail++
        continue
      }

      // Find the AddressBook database
      const dbPath = join(sourcePath, 'AddressBook-v22.abcddb')
      if (!existsSync(dbPath)) continue

      // Query contacts with phone numbers from this source
      const db = new Database(dbPath, { readonly: true })
      try {
        const contacts = db.prepare(`
          SELECT DISTINCT
            r.Z_PK as id,
            r.ZFIRSTNAME as firstName,
            r.ZLASTNAME as lastName,
            r.ZORGANIZATION as organization,
            r.ZJOBTITLE as title,
            r.ZNOTE as notes,
            (SELECT GROUP_CONCAT(p.ZFULLNUMBER, '|')
             FROM ZABCDPHONENUMBER p
             WHERE p.ZOWNER = r.Z_PK) as phones,
            (SELECT GROUP_CONCAT(e.ZADDRESS, '|')
             FROM ZABCDEMAILADDRESS e
             WHERE e.ZOWNER = r.Z_PK) as emails
          FROM ZABCDRECORD r
          WHERE EXISTS (
            SELECT 1 FROM ZABCDPHONENUMBER p WHERE p.ZOWNER = r.Z_PK
          )
        `).all() as Array<{
          id: number
          firstName: string | null
          lastName: string | null
          organization: string | null
          title: string | null
          notes: string | null
          phones: string | null
          emails: string | null
        }>

        for (const contact of contacts) {
          // Skip contacts without a name
          if (!contact.firstName && !contact.lastName && !contact.organization) {
            continue
          }

          const firstName = contact.firstName || ''
          const lastName = contact.lastName || contact.organization || ''
          const phone = contact.phones?.split('|')[0] || null
          const email = contact.emails?.split('|')[0]?.toLowerCase() || null

          try {
            await prisma.contact.create({
              data: {
                firstName,
                lastName,
                phone,
                email,
                organization: contact.organization || null,
                title: contact.title || null,
                notes: contact.notes || null,
              },
            })
            imported++
          } catch (err: any) {
            if (err.code === 'P2002') {
              errors.push({ contact: `${firstName} ${lastName}`, message: 'Duplicate contact' })
            } else {
              errors.push({ contact: `${firstName} ${lastName}`, message: err.message })
            }
          }
        }
      } finally {
        db.close()
      }
    }

    res.json({
      data: {
        imported,
        skippedNoPhone,
        skippedNonICloud: skippedGmail,
        errors,
      },
    })
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'IMPORT_ERROR', message: err.message },
    })
  } finally {
    // Clean up temp directory
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  }
})

// Helper to find Sources directory (may be nested in .abbu structure)
function findSourcesDir(dir: string): string | null {
  const sourcesPath = join(dir, 'Sources')
  if (existsSync(sourcesPath)) return sourcesPath

  // Check one level deep (sometimes .abbu has a wrapper folder)
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const nested = join(dir, entry, 'Sources')
    if (existsSync(nested)) return nested
  }
  return null
}

// Determine source type from metadata
function getSourceType(sourcePath: string): 'icloud' | 'gmail' | 'exchange' | 'local' | 'unknown' {
  // Check for metadata plist files that indicate source type
  const metadataPath = join(sourcePath, 'Metadata')
  if (existsSync(metadataPath)) {
    try {
      const files = readdirSync(metadataPath)
      for (const file of files) {
        if (file.endsWith('.plist')) {
          const content = readFileSync(join(metadataPath, file), 'utf-8')
          if (content.includes('google') || content.includes('gmail')) return 'gmail'
          if (content.includes('exchange') || content.includes('outlook')) return 'exchange'
          if (content.includes('icloud') || content.includes('com.apple')) return 'icloud'
        }
      }
    } catch {}
  }

  // Check Configuration.plist in source root
  const configPath = join(sourcePath, 'Configuration.plist')
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8')
      if (content.includes('google') || content.includes('gmail')) return 'gmail'
      if (content.includes('exchange') || content.includes('outlook')) return 'exchange'
      if (content.includes('icloud') || content.includes('com.apple')) return 'icloud'
    } catch {}
  }

  // Default to local (On My Mac) which we'll include
  return 'local'
}

export default router
