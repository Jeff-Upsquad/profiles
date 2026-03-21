# SquadHire — Talent Marketplace Platform

A full-stack talent marketplace where job seekers create professional profiles and businesses discover and hire them. Supports multiple job categories with dynamic profile schemas managed from an admin panel.

## Architecture

```
├── supabase/migrations/   # PostgreSQL schema (7 migration files)
├── shared/                # Shared TypeScript types
├── backend/               # Node.js + Express API (TypeScript)
├── frontend/              # React + Vite main app (Talent & Business)
├── admin/                 # React + Vite admin panel
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, TailwindCSS v4, TanStack Query |
| Backend | Node.js, Express, TypeScript, Zod validation |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| File Storage | Cloudflare R2 (S3-compatible) |
| Auth | Supabase Auth (JWT + email/password) |

## Prerequisites

- Node.js 20+
- A Supabase project (free tier works)
- (Optional) Cloudflare R2 bucket for file uploads

## Setup

### 1. Database

Run the migration files in order against your Supabase project:

```bash
# Using Supabase CLI
supabase db push

# Or manually run each file in supabase/migrations/ via the SQL editor
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in your Supabase URL, keys, etc.
npm install
npm run dev    # Starts on port 5000
```

**Required environment variables:**
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
- `PORT` — Server port (default: 5000)
- `CORS_ORIGIN` — Allowed origins (e.g., `http://localhost:5173,http://localhost:5174`)

**Optional (for file uploads):**
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

### 3. Frontend (Main App)

```bash
cd frontend
npm install
npm run dev    # Starts on port 5173
```

### 4. Admin Panel

```bash
cd admin
npm install
npm run dev    # Starts on port 5174
```

## User Roles

| Role | Description |
|------|-------------|
| **Talent** | Create profiles per job category, upload resumes, track approval status |
| **Business** | Browse approved profiles, shortlist, send interest requests |
| **Admin** | Manage categories/fields, review profiles, manage users, recycle bin |

## Key Features

### Dynamic Profile Schema
- Admins create job categories (Accountant, Video Editor, etc.)
- Each category has custom fields (text, select, multi-select, file upload, etc.)
- Talent profiles use JSONB to store dynamic field data — no migrations needed for new categories

### Profile Lifecycle
```
Draft → Pending Review → Approved (Active)
                       → Rejected → Edit & Resubmit
Active → Deactivated → Reactivated (Pending Review)
Active → Deleted (Soft) → Restored (Pending Review) / Permanently Deleted
```

### Security
- JWT auth via Supabase Auth
- Row Level Security (RLS) on all tables
- Zod validation on all API endpoints
- RBAC middleware (talent/business/admin)
- Presigned URLs for file uploads (5-min expiry)

## API Endpoints

### Auth
- `POST /api/auth/signup/talent` — Register as talent
- `POST /api/auth/signup/business` — Register as business
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Get current user

### Talent
- `GET/PUT /api/talent/me` — Talent user info
- `GET/POST /api/talent/profiles` — List/create profiles
- `PUT /api/talent/profiles/:id` — Update profile
- `PATCH /api/talent/profiles/:id/submit` — Submit for review
- `PATCH /api/talent/profiles/:id/deactivate` — Deactivate
- `PATCH /api/talent/profiles/:id/reactivate` — Reactivate
- `DELETE /api/talent/profiles/:id` — Soft delete

### Business
- `GET /api/business/discover/:categorySlug` — Browse profiles
- `POST /api/business/shortlist/:profileId` — Add to shortlist
- `POST /api/business/interest/:profileId` — Send interest request

### Admin
- `GET /api/admin/dashboard/stats` — Dashboard stats
- CRUD for categories, fields, field options
- `GET/PATCH /api/admin/reviews` — Profile review queue
- `GET /api/admin/users/talent|business` — User management
- `GET/PATCH/DELETE /api/admin/recycle-bin` — Deleted profiles

## Development

```bash
# Run all three in separate terminals:
cd backend && npm run dev
cd frontend && npm run dev
cd admin && npm run dev
```

Frontend proxies `/api` to `http://localhost:5000` via Vite config.
