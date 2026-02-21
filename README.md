# StaySafeBG

Multi-page Vite app (Vanilla JS + Bootstrap) with Supabase backend (DB + Auth + Storage).

## Local setup

1. Install dependencies:
   - `npm install`
2. Create `.env` from `.env.example` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Run dev server:
   - `npm run dev`

## Supabase migrations (append-only)

Migration files are in `supabase/migrations`.

Rules:
- Never edit already applied migrations.
- Every DB change must be a new migration file.
- Local migration files and DB migration history must stay in sync (no drift).

Current migrations:
- `20260216121000_init_core_schema_and_rls.sql`
- `20260216122000_add_evidence_storage_policies.sql`

## What is implemented

- Supabase Auth services: register/login/logout/current user
- Supabase DB services: articles, scam reports, report files
- Supabase Storage services: evidence uploads
- RLS-ready schema and policies for app core tables and storage

## Notes

- `admin.html` is role-protected (`role = admin`).
- `report-scam.html` requires logged-in user and uploads files to `evidence` bucket path `userId/reportId/file`.

## Advanced scam check (recommended)

For the most reliable check on `scam-check.html`, deploy the Supabase Edge Function:

1. Create function in your Supabase project from `supabase/functions/threat-check/index.ts`
2. Deploy it as `threat-check`
3. (Optional, recommended) add secret `GOOGLE_SAFE_BROWSING_API_KEY` to the function environment

What it does:
- Checks local DB (`scam_reports` with `approved` status)
- Aggregates multiple internet sources (`phish.sinking.yachts`, `URLhaus`, optional `Google Safe Browsing`)
- Returns weighted `riskScore` and verdict (`clean`, `warning`, `danger`)

Fallback behavior:
- If the Edge Function is unavailable, frontend automatically falls back to direct basic internet check.
