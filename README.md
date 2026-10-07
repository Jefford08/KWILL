
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


