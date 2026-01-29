# Citadel CRM

A personal CRM for managing contacts, tracking interactions, setting reminders, and surfacing stale relationships.

## Prerequisites

- Node.js 20+
- PostgreSQL 16

## Quick Start

Start PostgreSQL (if not already running):

```sh
brew services start postgresql@16
createdb personal_crm
```

Backend:

```sh
cd backend
npm install
cp .env.example .env   # edit DATABASE_URL if needed
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Frontend:

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://...@localhost:5432/personal_crm` | PostgreSQL connection string |
| `PORT` | `3001` | Express server port |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated CORS origins |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | (empty) | API base URL. Leave empty in dev to use Vite proxy. Set to backend URL in production. |

## Project Structure

```
palantini/
  backend/
    prisma/
      schema.prisma     # Data model
      seed.ts           # Sample data
    src/
      config/           # Database, environment
      middleware/        # Error handler, validation
      routes/           # Express route handlers
      validators/       # Zod schemas
      app.ts            # Express app setup
      server.ts         # Entry point
  frontend/
    src/
      api/              # API client functions
      components/       # Reusable UI components
      hooks/            # React Query hooks
      pages/            # Route pages
      types/            # TypeScript interfaces
```

## Tech Stack

- **Backend**: Express 5, Prisma 7, PostgreSQL 16, Zod 4, TypeScript
- **Frontend**: React 19, Vite 7, Tailwind CSS 4, TanStack Query 5, React Router 7

## Features

- Contact management with search, filter, sort, and pagination
- Interaction logging (calls, texts, emails, meetings, mail, notes)
- "Needs attention" badges for contacts not contacted within a configurable threshold
- Upcoming birthday and notable date tracking
- Reminders with overdue highlighting
- Tags and groups for organizing contacts
- CSV/JSON bulk import
- Dashboard with stats and activity overview
