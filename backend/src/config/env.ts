import 'dotenv/config'

const configuredOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())

// Allow Vercel preview deployments (*.vercel.app)
const vercelPreviewPattern = /^https:\/\/.*\.vercel\.app$/

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  ALLOWED_ORIGINS: configuredOrigins,
  isAllowedOrigin: (origin: string | undefined): boolean => {
    if (!origin) return true // Allow requests without origin (e.g., curl)
    if (configuredOrigins.includes(origin)) return true
    if (vercelPreviewPattern.test(origin)) return true
    return false
  },
}
