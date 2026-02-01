import JSZip from 'jszip'
import initSqlJs, { type Database } from 'sql.js'

export interface ParsedContact {
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  organization: string | null
  title: string | null
  notes: string | null
}

export interface ParseResult {
  contacts: ParsedContact[]
  skippedNoPhone: number
  skippedNonICloud: number
}

async function getSourceTypeAsync(zip: JSZip, sourcePath: string): Promise<'icloud' | 'gmail' | 'exchange' | 'local'> {
  const checkContent = (content: string): 'icloud' | 'gmail' | 'exchange' | 'local' | null => {
    const lower = content.toLowerCase()
    if (lower.includes('google') || lower.includes('gmail')) return 'gmail'
    if (lower.includes('exchange') || lower.includes('outlook')) return 'exchange'
    if (lower.includes('icloud') || lower.includes('com.apple')) return 'icloud'
    return null
  }

  // Check Configuration.plist first
  const configFile = zip.file(`${sourcePath}/Configuration.plist`)
  if (configFile) {
    try {
      const content = await configFile.async('string')
      const type = checkContent(content)
      if (type) return type
    } catch {}
  }

  // Check Metadata directory
  const metadataPrefix = `${sourcePath}/Metadata/`
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.startsWith(metadataPrefix) && path.endsWith('.plist') && !file.dir) {
      try {
        const content = await file.async('string')
        const type = checkContent(content)
        if (type) return type
      } catch {}
    }
  }

  return 'local'
}

export async function parseAbbuFile(file: File): Promise<ParseResult> {
  // Initialize SQL.js with WASM
  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`
  })

  const zip = await JSZip.loadAsync(file)

  // Find Sources directory (may be nested)
  let sourcesPrefix = 'Sources/'
  const paths = Object.keys(zip.files)

  if (!paths.some(p => p.startsWith(sourcesPrefix))) {
    // Check one level deep
    for (const path of paths) {
      if (path.includes('/Sources/')) {
        sourcesPrefix = path.substring(0, path.indexOf('/Sources/') + 9)
        break
      }
    }
  }

  if (!paths.some(p => p.startsWith(sourcesPrefix))) {
    throw new Error('Could not find Sources directory in .abbu file')
  }

  // Find all source directories
  const sourceIds = new Set<string>()
  for (const path of paths) {
    if (path.startsWith(sourcesPrefix)) {
      const rest = path.substring(sourcesPrefix.length)
      const parts = rest.split('/')
      if (parts[0] && parts[0].length > 0) {
        sourceIds.add(parts[0])
      }
    }
  }

  const contacts: ParsedContact[] = []
  let skippedNoPhone = 0
  let skippedNonICloud = 0

  for (const sourceId of sourceIds) {
    const sourcePath = `${sourcesPrefix}${sourceId}`

    // Check source type
    const sourceType = await getSourceTypeAsync(zip, sourcePath)
    if (sourceType === 'gmail' || sourceType === 'exchange') {
      skippedNonICloud++
      continue
    }

    // Find AddressBook database
    const dbPath = `${sourcePath}/AddressBook-v22.abcddb`
    const dbFile = zip.file(dbPath)

    if (!dbFile) continue

    // Load database
    const dbData = await dbFile.async('uint8array')
    let db: Database

    try {
      db = new SQL.Database(dbData)
    } catch (e) {
      console.warn(`Failed to open database at ${dbPath}:`, e)
      continue
    }

    try {
      // Query contacts with phone numbers
      // Note: ZNOTE is a foreign key, actual notes are in ZABCDNOTE table
      const results = db.exec(`
        SELECT DISTINCT
          r.Z_PK as id,
          r.ZFIRSTNAME as firstName,
          r.ZLASTNAME as lastName,
          r.ZORGANIZATION as organization,
          r.ZJOBTITLE as title,
          (SELECT n.ZTEXT FROM ZABCDNOTE n WHERE n.ZCONTACT = r.Z_PK LIMIT 1) as notes,
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
      `)

      if (results.length > 0) {
        const columns = results[0].columns
        const values = results[0].values

        for (const row of values) {
          const record: Record<string, any> = {}
          columns.forEach((col, i) => {
            record[col] = row[i]
          })

          // Handle name fallbacks - ensure we always have firstName and lastName
          let firstName = record.firstName || ''
          let lastName = record.lastName || ''

          // If no last name but has organization, use organization as last name
          if (!lastName && record.organization) {
            lastName = record.organization
          }

          // If still no name at all, skip this contact
          if (!firstName && !lastName) {
            continue
          }

          // If only one name part, put it in lastName (more common for single-name entries)
          if (firstName && !lastName) {
            lastName = firstName
            firstName = ''
          }

          const phones = record.phones?.split('|') || []
          const emails = record.emails?.split('|') || []

          // Ensure notes is a string or null, not a number
          const notes = typeof record.notes === 'string' ? record.notes : null

          contacts.push({
            firstName,
            lastName,
            phone: phones[0] || null,
            email: emails[0]?.toLowerCase() || null,
            organization: record.organization || null,
            title: record.title || null,
            notes,
          })
        }
      }
    } finally {
      db.close()
    }
  }

  return {
    contacts,
    skippedNoPhone,
    skippedNonICloud,
  }
}
