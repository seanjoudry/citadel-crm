import JSZip from 'jszip'
import initSqlJs, { Database } from 'sql.js'

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

// Determine source type from metadata files
function getSourceType(files: JSZip, sourcePath: string): 'icloud' | 'gmail' | 'exchange' | 'local' {
  const checkContent = (content: string): 'icloud' | 'gmail' | 'exchange' | 'local' => {
    const lower = content.toLowerCase()
    if (lower.includes('google') || lower.includes('gmail')) return 'gmail'
    if (lower.includes('exchange') || lower.includes('outlook')) return 'exchange'
    if (lower.includes('icloud') || lower.includes('com.apple')) return 'icloud'
    return 'local'
  }

  // Check metadata directory
  const metadataPath = `${sourcePath}/Metadata/`
  const metadataFiles = Object.keys(files.files).filter(f => f.startsWith(metadataPath) && f.endsWith('.plist'))

  for (const file of metadataFiles) {
    const content = files.files[file]
    if (content && !content.dir) {
      // We'll check this asynchronously
    }
  }

  // Check Configuration.plist
  const configPath = `${sourcePath}/Configuration.plist`
  if (files.files[configPath]) {
    // Will check content
  }

  return 'local' // Default to local which we'll include
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
      const results = db.exec(`
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
      `)

      if (results.length > 0) {
        const columns = results[0].columns
        const values = results[0].values

        for (const row of values) {
          const record: Record<string, any> = {}
          columns.forEach((col, i) => {
            record[col] = row[i]
          })

          const firstName = record.firstName || ''
          const lastName = record.lastName || record.organization || ''

          // Skip contacts without a name
          if (!firstName && !lastName && !record.organization) {
            continue
          }

          const phones = record.phones?.split('|') || []
          const emails = record.emails?.split('|') || []

          contacts.push({
            firstName,
            lastName,
            phone: phones[0] || null,
            email: emails[0]?.toLowerCase() || null,
            organization: record.organization || null,
            title: record.title || null,
            notes: record.notes || null,
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
