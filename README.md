
# Kwill — Quail Farm Management System

A web app for managing a quail farm: user accounts, a dashboard of key stats, egg
production tracking, quail population & mortality tracking, feed logging, sales &
expenses, trend charts, and PDF report export.

## System Architecture

Kwill is a server-rendered Node.js/Express app — the browser talks directly to an Express
server that renders EJS pages. Routes hand off to controllers, which query a PostgreSQL database hosted on Supabase through a pooled
connection, and render views back to the browser. express-session handles login state (sessions are stored in the same database);
PDF report export uses Puppeteer to render report pages headlessly. Pushing to GitHub triggers Vercel to automatically rebuild and redeploy the app.

<img width="537" height="462" alt="e5631a08-f6aa-41f6-a731-57d3d18dca36" src="https://github.com/user-attachments/assets/948602b2-d462-4430-99b3-4686e536b927" />


## Setup

### 1. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com) and note the database password.
2. In the project, click **Connect** and copy the **Transaction pooler** connection string (port `6543`).
3. Replace `[YOUR-PASSWORD]` in it with your password. URL-encode special characters, e.g. `@` → `%40`.

The app creates its tables automatically on startup (`src/db/schema.sql`), and turns on Row Level
Security so Supabase's public REST API can't read them. The app itself connects directly and is unaffected.

### 2. Run locally

```bash
npm install
cp .env.example .env      # then paste your Supabase string into DATABASE_URL
npm run db:check          # confirms the connection and lists the tables
npm run db:init           # creates the tables (optional — startup does this too)
npm run dev
```

### 3. Deploy (Vercel)

In Vercel → Project → **Settings → Environment Variables**, add:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler string (port 6543) |
| `SESSION_SECRET` | a long random string |
| `NODE_ENV` | `production` |
| `PUPPETEER_SKIP_DOWNLOAD` | `true` |

Then redeploy. Every push to `main` deploys automatically.

Alternatively, connect Supabase through Vercel → **Storage / Integrations → Supabase**; it sets
`POSTGRES_URL` for you, which the app also accepts in place of `DATABASE_URL`.
