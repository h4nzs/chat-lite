# Chat-Lite

Full-stack chat sederhana: React + Vite + TS (frontend), Node + Express + Prisma (backend), PostgreSQL.

## Cepat Mulai (Local)
1. Install Node 20, pnpm, PostgreSQL 15.
2. `cp .env.example .env` lalu sesuaikan nilai.
3. **Backend**: `cd server && pnpm i && npx prisma migrate dev && pnpm seed && pnpm dev`
4. **Frontend**: `cd web && pnpm i && pnpm dev`
5. Buka `http://localhost:5173`.

## Deploy Ringkas
- Backend + DB: Railway/Render. Set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`.
- Frontend: Vercel. Set `VITE_API_URL`, `VITE_WS_URL` ke URL backend produksi.