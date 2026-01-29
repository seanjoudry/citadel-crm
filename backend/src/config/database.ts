import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

// Dynamic import needed for Prisma v7 ESM
const { PrismaClient } = await import('../../node_modules/.prisma/client/client.js')
const prisma = new PrismaClient({ adapter })

export default prisma
