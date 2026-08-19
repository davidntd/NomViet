# Nôm Việt

A reference tool for researching and learning **Chữ Nôm**, the traditional Vietnamese writing system. Explore characters by reading, glyph, stroke count, or definition; draw characters to search; and translate Quốc Ngữ into **Quốc Âm Tân Tự (QATT)** phonetic script with optional Chữ Nôm character selection.

## Features

- **Search** — search ~100k CJK ideographs by Nôm/Hán Việt reading, definition, Unicode, or exact glyph
- **Draw** — sketch a character and find candidates by stroke count
- **Character pages** — readings, definitions, stroke count, variants, and images
- **Translate** — converts Quốc Ngữ input to Quốc Âm Tân Tự (rendered with the embedded `GotichQATT.ttf`), then lets you pick the intended Chữ Nôm character from a list of candidates when several meanings share the same pronunciation
- **Bilingual** — English / Vietnamese UI
- **Admin dashboard** — password-protected character CRUD, batch edit, image upload, and DB reset (sign in at `/admin`)

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React
- [Supabase](https://supabase.com) (Postgres + storage)
- [Tailwind CSS](https://tailwindcss.com) v4

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase credentials:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (safe to expose) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key — server-side only, never exposed to the client |

3. Run the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Database setup

The schema and helper SQL live in the `supabase/` folder (kept out of version control — see below):

- `character.sql` — the `Character` table (the `character` column holds either the glyph or an image URL; there is no separate unicode/image column)
- `characters-storage.sql` — public storage bucket for character images
- `search-by-reading.sql` — `search_characters_by_reading` RPC used by search
- `reset-character-table.sql` — resets the table
- `character-image-migration.sql` — migration for existing tables: merges `image` into `character`, drops the `unicode` and `image` columns (run once in the Supabase SQL Editor)

## Admin dashboard

The password-protected administrator dashboard lives at `/admin` (character CRUD, batch edit, image upload, and DB reset). It authenticates with Supabase Auth using email/password.

Make sure your Supabase project is ready before deploying:

1. Enable the Email provider (**Authentication → Providers → Email**).
2. Create an admin user (**Authentication → Users → Add user**) with the email and password you sign in with.
3. Apply the schema in `supabase/character.sql` and `supabase/characters-storage.sql` (if you haven't already) so the dashboard has a table and storage bucket to work with.

The dashboard uses the same environment variables as the rest of the app. The service role key is used only inside server-side API routes and is never sent to the browser. Any account with a valid Supabase Auth session can access the dashboard, so keep public sign-up disabled and only create accounts you trust.

## Deployment

This app deploys as a standard Next.js server (`npm run build` + `npm start`). It works with Vercel, Netlify, Railway, or any Node host.

Before deploying, set the three environment variables from `.env.example` in your hosting platform's settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (used by the search and admin API routes on the server)

Then deploy the repo as you normally would (e.g., Vercel will run `npm install`, `npm run build`, `npm start` automatically).

## Local-only tooling (gitignored)

The following are **not committed** and won't exist in a deployed build:

- `scripts/` — one-off data import scripts (`import:cjk`, `import:thaiphong-hvdic`), documented in `scripts/README.md`
- `data/` — import checkpoints and scratch files
- `supabase/` — database setup SQL (applied once in the Supabase SQL editor)
- `.env` — local secrets (use `.env.example` as the template)

The admin dashboard (`app/admin/` + `app/api/admin/`) **is** committed and ships with the deployed build.

## Importing data

The character database is populated with local scripts (service-role credentials required):

```bash
npm run import:cjk                # import ~103k CJK ideographs from Unicode
npm run import:thaiphong-hvdic   # enrich with readings/definitions from Thaiphong HVDIC
```

See `scripts/README.md` for details and flags.
