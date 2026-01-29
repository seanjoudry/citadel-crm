import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import contactsRouter from './routes/contacts.js'
import interactionsRouter from './routes/interactions.js'
import tagsRouter from './routes/tags.js'
import groupsRouter from './routes/groups.js'
import remindersRouter from './routes/reminders.js'
import notableDatesRouter from './routes/notable-dates.js'
import dashboardRouter from './routes/dashboard.js'
import settingsRouter from './routes/settings.js'
import importRouter from './routes/import.js'

const app = express()

// Middleware
app.use(cors({ origin: env.ALLOWED_ORIGINS, credentials: true }))
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: false }))

// Routes
app.use('/api/contacts', contactsRouter)
app.use('/api', interactionsRouter) // Mounts /api/contacts/:contactId/interactions and /api/interactions/:id
app.use('/api/tags', tagsRouter)
app.use('/api', tagsRouter) // Also mounts /api/contacts/:contactId/tags
app.use('/api/groups', groupsRouter)
app.use('/api', groupsRouter) // Also mounts /api/contacts/:contactId/groups
app.use('/api/reminders', remindersRouter)
app.use('/api', remindersRouter) // Also mounts /api/contacts/:contactId/reminders
app.use('/api/notable-dates', notableDatesRouter)
app.use('/api', notableDatesRouter) // Also mounts /api/contacts/:contactId/notable-dates
app.use('/api/dashboard', dashboardRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/import', importRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Error handler (must be last)
app.use(errorHandler)

export default app
