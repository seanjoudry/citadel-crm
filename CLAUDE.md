# CLAUDE.md - Citadel CRM

This file provides guidance for Claude Code when working with this codebase.

## Project Overview

Citadel CRM is a personal relationship management system for managing contacts, tracking interactions, setting reminders, and surfacing stale relationships. It helps users maintain meaningful connections by highlighting contacts that need attention.

## Tech Stack

### Backend
- **Runtime**: Node.js 20+, TypeScript 5.9
- **Framework**: Express 5.x
- **Database**: PostgreSQL 16 with Prisma 7 ORM
- **Validation**: Zod 4.x for request/response schemas

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **State Management**: TanStack Query 5 (React Query)
- **Routing**: React Router 7
- **Date Handling**: date-fns 4

### Sync Script (macOS only)
- **Language**: Python 3.9+
- **CLI**: Click
- **Purpose**: Sync contacts, iMessages, and call history from macOS

## Project Structure

```
citadel-crm/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Data models and enums
│   │   ├── seed.ts             # Sample data
│   │   └── migrations/         # Migration history
│   └── src/
│       ├── config/             # Environment and database setup
│       ├── middleware/         # Error handler, validation
│       ├── routes/             # API endpoint handlers
│       ├── validators/         # Zod request schemas
│       ├── constants/          # Cadence values, app constants
│       ├── app.ts              # Express app and routing
│       └── server.ts           # Entry point
├── frontend/
│   └── src/
│       ├── api/                # API client functions
│       ├── components/         # React components
│       │   ├── layout/         # AppLayout, Sidebar
│       │   ├── contacts/       # Contact-specific components
│       │   ├── tags/           # Tag display components
│       │   └── shared/         # Dialogs, avatars, pagination
│       ├── hooks/              # TanStack Query hooks
│       ├── pages/              # Route pages
│       ├── types/              # TypeScript interfaces
│       └── utils/              # Helpers (abbu-parser, etc.)
├── sync-script/                # Python macOS sync tool
└── plans/                      # Feature planning documents
```

## Key Commands

### Backend
```sh
cd backend
npm install
npx prisma migrate dev      # Run migrations
npx prisma db seed          # Seed sample data
npx prisma generate         # Regenerate Prisma client
npm run dev                 # Start dev server (port 3001)
```

### Frontend
```sh
cd frontend
npm install
npm run dev                 # Start dev server (port 5173)
npm run build               # Production build
npm run lint                # ESLint check
```

### Database
```sh
# Start PostgreSQL (macOS)
brew services start postgresql@16

# Create database
createdb personal_crm

# Reset database
npx prisma migrate reset
```

## Data Models

### Core Entities
- **Contact**: Person with contact info, cadence settings, and relationships
- **Interaction**: Communication event (call, text, email, meeting, note)
- **Reminder**: Alert with date and completion status
- **NotableDate**: Birthday, anniversary, or custom date
- **Tag**: Label for organizing contacts (many-to-many via ContactTag)
- **Group**: Contact grouping (many-to-many via ContactGroup)
- **Region**: Geographic region for contact organization
- **Settings**: Key-value store for app configuration

### Enums
- **InteractionType**: CALL_INBOUND, CALL_OUTBOUND, CALL_MISSED, TEXT_INBOUND, TEXT_OUTBOUND, EMAIL_INBOUND, EMAIL_OUTBOUND, MEETING, MAIL_SENT, MAIL_RECEIVED, NOTE, OTHER
- **InteractionSource**: MANUAL, IMPORT_IOS, IMPORT_ANDROID, IMPORT_EMAIL, API
- **NotableDateType**: BIRTHDAY, ANNIVERSARY, FIRST_MET, ELECTION, CUSTOM
- **ContactCadence**: BIWEEKLY (14d), MONTHLY (30d), BIMONTHLY (60d), QUARTERLY (90d), SEMIANNUAL (180d), ANNUAL (365d)

## API Routes

| Route | Purpose |
|-------|---------|
| `/api/contacts` | CRUD for contacts, search, filter |
| `/api/contacts/:id/interactions` | Interactions for a contact |
| `/api/contacts/:id/tags` | Assign/remove tags |
| `/api/contacts/:id/groups` | Assign/remove groups |
| `/api/contacts/:id/reminders` | Reminders for a contact |
| `/api/contacts/:id/notable-dates` | Notable dates for a contact |
| `/api/contacts/:id/activity-heatmap` | Activity heatmap data |
| `/api/tags` | Tag management |
| `/api/groups` | Group management |
| `/api/reminders` | All reminders |
| `/api/notable-dates` | All notable dates |
| `/api/dashboard` | Stats, needs attention, lapsed |
| `/api/settings` | App settings |
| `/api/import` | Bulk CSV/JSON/ABBU import |
| `/api/regions` | Region management |
| `/api/health` | Health check |

## Key Features & Business Logic

### Needs Attention
- Contacts not contacted within configurable threshold (default: 30 days)
- Only counts **outbound** interactions (CALL_OUTBOUND, TEXT_OUTBOUND, EMAIL_OUTBOUND, MEETING, MAIL_SENT)
- Dashboard surfaces these contacts prominently

### Contact Cadence
- Optional cadence per contact (how often to reach out)
- `contactDueAt` auto-calculated: `lastContactedAt + cadence days`
- "Lapsed Contacts" = contacts past their due date

### Import Support
- CSV/JSON for contacts and interactions
- Apple Address Book (.abbu) files - parsed client-side
- Validation with row-level error reporting
- Interactions matched to contacts by email

## Code Conventions

### Backend
- Route handlers in `routes/*.ts`
- Zod validators in `validators/*.ts`
- Prisma schema uses `@map` for snake_case DB columns
- TypeScript with strict mode
- ESM modules (`"type": "module"`)

### Frontend
- TanStack Query for all API calls (hooks in `hooks/`)
- API client functions in `api/`
- Components organized by domain
- Tailwind for styling (no CSS files)
- TypeScript with strict mode

### Database
- PostgreSQL with Prisma
- snake_case columns, camelCase in code
- Cascade deletes on relationships
- Indexed columns: `contactDueAt`, `remindAt`, `month/day`

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/personal_crm
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=           # Empty in dev (uses Vite proxy)
```

## Testing

No test framework is currently configured. Consider:
- Vitest for frontend (aligns with Vite)
- Jest or Vitest for backend
- Testing Library for component tests

## Common Tasks

### Add a new API endpoint
1. Create/update route in `backend/src/routes/`
2. Add Zod validator in `backend/src/validators/`
3. Register route in `backend/src/app.ts` if new file
4. Add API client function in `frontend/src/api/`
5. Create TanStack Query hook in `frontend/src/hooks/`

### Add a new database field
1. Update `backend/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name describe_change`
3. Update TypeScript types in `frontend/src/types/`
4. Update Zod validators as needed

### Add a new page
1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Add navigation link in `frontend/src/components/layout/Sidebar.tsx`

## Deployment

### Frontend (Vercel)
- Hosted on Vercel with automatic deployments from main branch
- Configuration in `frontend/vercel.json`
- SPA routing: all paths rewrite to `/index.html`
- Set `VITE_API_URL` environment variable to Railway backend URL

**Vercel Setup:**
1. Connect GitHub repo to Vercel
2. Set root directory to `frontend`
3. Framework preset: Vite
4. Add environment variable: `VITE_API_URL=https://your-railway-app.railway.app`

### Backend (Railway)
- Hosted on Railway with automatic deployments
- PostgreSQL database provisioned on Railway
- Uses `DATABASE_URL` from Railway's PostgreSQL plugin

**Railway Setup:**
1. Create new project from GitHub repo
2. Set root directory to `backend`
3. Add PostgreSQL database (plugin)
4. Environment variables are auto-configured for `DATABASE_URL`
5. Add `ALLOWED_ORIGINS` with your Vercel frontend URL
6. Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
7. Start command: `npm start`

**Production Environment Variables:**

| Service | Variable | Value |
|---------|----------|-------|
| Vercel | `VITE_API_URL` | Railway backend URL |
| Railway | `DATABASE_URL` | Auto-set by PostgreSQL plugin |
| Railway | `ALLOWED_ORIGINS` | Vercel frontend URL |
| Railway | `PORT` | Auto-set by Railway |

### Deployment Workflow
1. Push to `main` branch
2. Vercel auto-deploys frontend
3. Railway auto-deploys backend and runs migrations

## Notes

- No authentication system - single-user design
- Prisma client output: `backend/src/generated/prisma`
- Server timeouts increased for large file uploads
- ABBU parsing happens client-side using jszip and sql.js
