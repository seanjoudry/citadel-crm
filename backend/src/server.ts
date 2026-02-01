import { env } from './config/env.js'
import app from './app.js'

const server = app.listen(env.PORT, () => {
  console.log(`Citadel CRM API running on http://localhost:${env.PORT}`)
})

// Increase timeouts for large file uploads
server.timeout = 600000 // 10 minutes
server.keepAliveTimeout = 620000
server.headersTimeout = 630000
