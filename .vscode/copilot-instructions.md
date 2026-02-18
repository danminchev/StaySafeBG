# GitHub Copilot Instructions — StaySafeBG

This repository contains a **multi-page web application** (HTML/CSS/JavaScript/Bootstrap) backed by **Supabase** (Database + Auth + Storage).  
The platform helps everyday users **learn about scams**, **search/check scams**, and **report/share scam cases**.

---

## 1) Product Context

**Working name:** StaySafeBG  
**Goal:** Provide clear, practical information to non-technical people about online scams and cyber threats.  
**Core features:**
- Register / Login / Logout (Supabase Auth)
- Read articles by category (phishing, card scams, fake travel offers, fake listings, marketplace scams, etc.)
- Scam search/check (by keyword, URL, phone, IBAN, etc.)
- User scam reports (create, view, share)
- Evidence uploads (images/screenshots/PDF) via Supabase Storage
- Admin moderation panel (approve/edit/remove content)

**Audience:** Non-technical users. Keep language simple and actionable.

**Safety:** This is a prevention/awareness app. Do **not** provide instructions that enable hacking/scamming.

---

## 2) Tech Stack & Constraints

- **Frontend:** HTML, CSS, JavaScript, Bootstrap (NO TypeScript, NO React/Vue).
- **Build tools:** Node.js, npm, Vite.
- **Backend:** Supabase (DB + Auth + Storage) via `@supabase/supabase-js`.
- **Navigation:** Multi-page (each screen is a separate `.html` file).
- **Architecture:** Client-server style where the JS frontend communicates with Supabase using the Supabase SDK.

---

## 3) Project Architecture & Folder Structure

**Suggested structure:**
- `src/pages/` — per-page scripts (DOM binding + events)
- `src/services/` — Supabase communication (auth/db/storage)
- `src/utils/` — helpers (validation, formatting, guards, toasts)
- `src/components/` — shared UI parts (navbar, footer, cards)
- `src/styles/` — global and page-specific CSS
- `public/` — static assets (icons, images)

**Rules:**
- Create the Supabase client **once** in `src/services/supabaseClient.js`.
- Do not call Supabase directly from page scripts; page scripts should call `services/*` functions.
- Keep page scripts small: read DOM → call services → render results.

---

## 4) Required Screens (Minimum 5+)

Recommended pages:
1. `index.html` — Home (latest articles/reports)
2. `register.html` — Registration
3. `login.html` — Login
4. `news.html` — News list + filters/categories
5. `news-details.html` — News details
6. `scam-check.html` — Search/check scams
7. `report-scam.html` — Submit a scam report + file upload
8. `admin.html` — Moderation panel (admin only)

---

## 5) Supabase Rules (Auth, DB, Storage)

### Auth
- Use Supabase Auth for email/password authentication.
- Rely on Supabase session/JWT handling.
- UI must reflect auth state (logged-in vs guest).

### Roles (RBAC)
- Use a `user_roles` table:
  - `user_id` (uuid, FK to `auth.users`)
  - `role` (text): `admin` or `user`
- Enforce access control with **Row Level Security (RLS)**.

### Database Tables (Core)
- `articles`:
  - `id`, `title`, `content`, `category`, `tags[]`, `created_at`, `author_id`, `is_published`
- `scam_reports`:
  - `id`, `title`, `description`, `category`, `scam_type`, `url`, `phone`, `iban`,
    `created_at`, `created_by`, `status` (`pending`/`approved`/`rejected`)
- `report_files`:
  - `id`, `report_id`, `file_path`, `mime_type`, `created_at`

### Storage
- Bucket name: `evidence`
- Upload path format: `userId/reportId/filename`
- Do not include sensitive data in file names.

---

## 6) Security & Content Safety

- Forbidden: hacking instructions, phishing templates, “how to steal cards”, exploit code, step-by-step scam methods.
- Allowed: prevention, detection tips, safe reporting steps, what to do after being scammed.
- Always sanitize/escape user-generated content (use `textContent`, avoid raw HTML injection).
- Mask sensitive values in UI (partial phone/IBAN if displayed).
- Admin panel must support moderation actions (approve/edit/reject/remove).

---

## 7) UI/UX Guidelines

- Mobile-first responsive design using Bootstrap grid.
- Clear categories, large buttons, simple forms.
- Provide user feedback with alerts/toasts.
- Validate inputs: email/password, URL format, required fields.
- Keep text practical: “red flags”, “how to check”, “what to do now”.

---

## 8) Coding Style

- Use ES Modules (`import`/`export`).
- Use `async/await` and `try/catch`.
- Keep logic separated:
  - `services/` = data + Supabase calls
  - `pages/` = DOM + event handlers + rendering
  - `utils/` = helpers
- Name functions clearly: `getArticles()`, `createReport()`, `uploadEvidence()`, `requireAuth()`, `requireAdmin()`.

---

## 9) Environment Variables

- Never commit secrets.
- Use `.env`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

---

## 10) Deployment & Demo

- Deploy to Netlify or Vercel.
- In `README.md` include:
  - Live URL
  - Demo credentials (e.g., `demo@staysafebg.com` / `demo12345`)
  - Local setup: `npm install`, `npm run dev`

---

## 11) MCP (Model Context Protocol) — Optional

- MCP may be used as an optional helper for AI tooling (e.g., validating migrations, RLS, project structure).
- MCP does **not** change the architecture: frontend remains HTML/CSS/JS; backend remains Supabase.
- The app must work without MCP; MCP is dev-assistance only.
- Never generate/log secret keys, tokens, or sensitive personal data.

---

## 12) How Copilot Should Work Here

- First propose a short plan.
- Then implement small, clear changes (file-by-file).
- Avoid unnecessary dependencies or “magic” frameworks.
- When DB changes are needed, provide SQL migrations and RLS policies.
- Prioritize security, moderation, and non-technical clarity.

---

## 13) Migration Discipline (Strict Append-Only)

**Core Rule:** Never edit an existing migration file. Ever.

1.  **Immutable History:**
    *   Once a migration file is created (`YYYYMMDDHHMMSS_name.sql`), it is **frozen**.
    *   Do not modify it to fix bugs or add columns.
    *   Do not delete it.

2.  **Changes = New Files:**
    *   Any change to the database (schema, RLS policies, functions, triggers) must go into a **new** migration file with a fresh timestamp.
    *   Example: If `01_init.sql` has a typo, create `02_fix_typo.sql`. Do not edit `01_init.sql`.

3.  **Process:**
    *   Create new file: `supabase/migrations/<timestamp>_<description>.sql`.
    *   Write the SQL change.
    *   Apply to local database (if running locally) or push to remote.
    *   verify the change works.

4.  **Drift Prevention:**
    *   If the remote database has migrations that are not local, sync them down (rename local files to match remote timestamps if strictly necessary for tools, or likely just ensure the content logic is applied).
    *   If you see a mismatch, **do not** change history. Add a new migration to bring the state in sync.

5.  **Why?**
    *   Editing old migrations breaks deployment consistency between environments (dev, staging, prod).
    *   It prevents "it works on my machine" issues where your local DB has a different version of "migration 1" than production.
