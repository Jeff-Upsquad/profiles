# SquadHire — Demo / Tutorial Environment

A self-contained, **isolated** environment for the **Talent** and **Business**
web modules, pre-loaded with realistic dummy data so you can click through every
feature and record tutorial videos — without touching production.

> **Why isolated?** On your normal setup, `localhost` talks to the **production**
> Supabase, and the schema has live automations (CRM webhooks, WhatsApp,
> notifications) that fire on real signups. This demo runs against a **dedicated
> demo Supabase project** instead, and the demo backend leaves all integration
> secrets unset, so **nothing leaks to CRM / WhatsApp / SquadHub.**

This worktree (`busy-lehmann-e790f9`) **is** the demo environment. It runs on its
own ports so it can run alongside your other previews:

| App      | Port | URL                                |
|----------|------|------------------------------------|
| Backend  | 5200 | http://localhost:5200/api          |
| Frontend | 3201 | http://localhost:3201              |
| Admin    | 3200 | http://localhost:3200/admin        |

## ✅ Status: already provisioned & seeded

The demo Supabase project **`squadhire-demo`** (ref `yetiwhxymuqczftgvivy`, same
org as prod, Mumbai region) is created, its keys are in `backend/.env`, the full
schema is applied, and the dummy data is seeded. **You can skip the one-time
setup below and go straight to "Running it".**

- **Reset/re-seed the data anytime:** `cd backend && npm run seed:demo`
- **Re-apply the schema (rarely needed):** `cd backend && DEMO_REF=yetiwhxymuqczftgvivy DEMO_DB_PASSWORD=<db-pw> MIGRATIONS_DIR=$(pwd)/../supabase/migrations npx tsx src/scripts/apply-schema.ts`
- The project's **database password** was generated at creation — keep it safe; it's resettable in the dashboard (Settings → Database) if lost.

The one-time setup section below is only for **recreating** the demo from scratch
(e.g. if you delete the project).

---

## 🔧 One-time setup

### 1. Create a dedicated demo Supabase project
Supabase dashboard → **New project** (free tier is fine). Name it e.g.
`squadhire-demo`. Wait for it to provision.

### 2. Paste the three keys into `backend/.env`
Dashboard → **Project Settings → API**, then edit `backend/.env` in this worktree:

```
SUPABASE_URL=https://<your-demo-ref>.supabase.co
SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret key>
```

### 3. Apply the database schema
**Option A — Supabase CLI (recommended, applies all migrations cleanly):**
```bash
supabase link --project-ref <your-demo-ref>     # paste the DB password when asked
supabase db push                                 # applies supabase/migrations/* in order
```
(If prompted that there's no config, run `supabase init` first and keep the
existing `supabase/migrations` folder.)

**Option B — SQL editor (no CLI needed):** open the demo project's **SQL Editor**,
paste the entire contents of [`demo/schema.sql`](./schema.sql) (all migrations
concatenated in order), and **Run**.

### 4. Install deps & seed the dummy data
```bash
cd backend && npm install && npm run seed:demo
```
The seed prints all login credentials at the end. It's **idempotent** — re-run it
any time to reset the demo data to a clean state.

> 🛡️ Safety: the seed refuses to run if `SUPABASE_URL` looks like production.
> For extra safety, export your real prod URL once so it's hard-blocked:
> `export PROD_SUPABASE_URL=https://<prod-ref>.supabase.co`

---

## ▶️ Running it

Use the **Demo Backend**, **Demo Frontend**, and **Demo Admin** entries in the
launch panel — or run manually in three terminals:

```bash
cd backend  && PORT=5200 npm run dev
cd frontend && BACKEND_URL=http://localhost:5200 npx next dev -p 3201
cd admin    && BACKEND_PORT=5200 npx next dev -p 3200
```

Then open **http://localhost:3201**.

---

## 🔑 Login credentials

**Password for every talent & admin login:** `Demo@1234`

| Role | Where | How to log in |
|------|-------|----------------|
| **Talent** | http://localhost:3201/login/talent | `talent.priya@demo.squadhire.test` (+ 11 more, e.g. `talent.arjun@…`, `talent.ananya@…`) + password |
| **Business** | http://localhost:3201/login/business | **Passwordless** — `acmefintech@demo.squadhire.test` *or* phone `+91 90000 11111` |
| **Admin** | http://localhost:3200/admin | `admin@demo.squadhire.test` + password |
| **Live signup demo** | http://localhost:3201/signup/talent | `newtalent@demo.squadhire.test` (a pending invite exists; auto-approves) |

The full talent/business list is printed by `npm run seed:demo`.

---

## 📦 What's seeded

- **2 job categories** — *Accountant* and *Designer + Editor* — each with its
  skills / tools / AI-tools profile-form templates.
- **12 talent accounts** across both categories, approved & active, with basic
  profiles, tiers (junior / pro / elite), Indian locations and languages.
- **3 business accounts** (Acme Fintech, PixelWorks Studio, Bright Retail Co),
  each subscribed to categories with **shared talent profiles** so the business
  dashboard is populated. One has a 30-day **talent-access grant**.
- **Subscription cards** (active briefs) with talent recipients in pending /
  accepted states.
- **Shortlists + interest requests** from a business to talents.
- **Training**: an onboarding course → chapter → lesson, plus a how-it-works video.
- **Notifications**: an unread broadcast delivered to several talents.
- A **pending talent invitation** so you can record the live signup flow.

---

## 🎬 Module map (for tutorial recording)

| Module | Surface | Log in as |
|--------|---------|-----------|
| Talent login / signup | `/login/talent`, `/signup/talent` | any talent / `newtalent@…` |
| Talent dashboard, briefs, notifications | `/dashboard`, `/talent/...` | any talent |
| Talent profile create/edit, training | `/talent/...` | any talent |
| Business login (email & phone) | `/login/business` | any business |
| Business dashboard, shared profiles, shortlist, interest | `/business/...` | `acmefintech@…` |
| Business subscriptions / brief review | `/business/...` | `pixelworks@…` / `brightretail@…` |
| Admin: approve talent, share profiles, grant access | `/admin` | `admin@…` |

---

## ♻️ Reset / re-seed
```bash
cd backend && npm run seed:demo      # wipes demo-tagged data, re-creates it fresh
```
Only data tagged with demo markers (`@demo.squadhire.test`, `demo-*` cards,
`[DEMO] …` titles/notes) is touched.

---

## 🔄 Keeping in sync with the original `main`

This demo worktree shares the SquadHire git repo, so syncing the latest code = a
`git merge main`. Use **`demo/sync.sh`**:

```bash
./demo/sync.sh            # merge main + apply any NEW migrations (keeps demo data)
./demo/sync.sh --reseed   # ...and re-seed the dummy data too (wipes + recreates)
```

It merges `main`, applies only migrations not yet in `demo/.applied-migrations`
(incremental, safe to re-run), and leaves your seeded data alone unless you pass
`--reseed`.

**Automatic:** guarded git hooks (`.git/hooks/post-merge` and `post-commit`) run
`sync.sh` in the background **whenever `main` updates locally** (a `git pull` or
merge into main) — so the demo tracks the original code without you doing
anything. The hooks **only fire on the `main` branch** (no-op elsewhere, so no
recursion). They sync code + migrations but **never auto-reseed**, so a recording
in progress is never wiped.

- Caveat: the hook triggers on a *committed/merged* change to main, not on
  unsaved edits in your editor (a separate worktree can only see committed code).
- If a sync brings new migrations, re-run `npm run seed:demo` if the seed needs to
  match the new schema (the sync log warns you).
- **Disable auto-sync:** `rm /Users/jeffzeena/Profiles/.git/hooks/post-merge /Users/jeffzeena/Profiles/.git/hooks/post-commit`

## ⚠️ Notes
- File uploads (resumes, portfolio, logos) are **disabled** in the demo (no R2
  bucket configured) — everything else works. Add R2 keys to `backend/.env` if
  you want to demo uploads.
- `backend/.env` and `*.env.local` are gitignored; nothing here is committed.
