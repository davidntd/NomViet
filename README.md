# Nôm Việt

A reference tool for researching and learning **Chữ Nôm**, the traditional Vietnamese writing system. Explore characters by reading, glyph, stroke count, or definition; draw characters to search; and translate Quốc Ngữ into **Quốc Âm Tân Tự (QATT)** phonetic script with optional Chữ Nôm character selection.

## Features

- **Search** — look up characters by Nôm/Hán Việt reading, definition, or exact glyph
- **Draw** — sketch a character and find candidates by stroke count
- **Character pages** — readings, definitions, stroke count, variants, and images
- **Translate** — converts Quốc Ngữ input to Quốc Âm Tân Tự, then lets you pick the intended Chữ Nôm character from a list of candidates when several meanings share the same pronunciation
- **Bilingual** — English / Vietnamese UI
- **Admin dashboard** — sign-in protected character management (sign in at `/admin`)

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

The database schema and setup SQL live in the local `supabase/` folder (not committed — see below) and are applied once in the Supabase SQL editor.

## Admin dashboard

The dashboard lives at `/admin` and authenticates with Supabase Auth (email/password). To use it:

1. Enable the Email provider (**Authentication → Providers → Email**).
2. Create an admin user (**Authentication → Users → Add user**) with the email and password you sign in with.
3. Keep public sign-up disabled so only accounts you create can sign in.

The service role key is used only inside server-side API routes and is never sent to the browser.

## Deployment

This app deploys as a standard Next.js server (`npm run build` + `npm start`). It works with Vercel, Netlify, Railway, or any Node host.

Before deploying, set the three environment variables from `.env.example` in your hosting platform's settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Then deploy the repo as you normally would (e.g., Vercel will run `npm install`, `npm run build`, `npm start` automatically).

## Local-only files (gitignored)

`scripts/`, `data/`, `supabase/`, and `.env` are kept out of version control and won't exist in a deployed build. The admin dashboard (`app/admin/` + `app/api/admin/`) **is** committed and ships with the deployed build.
