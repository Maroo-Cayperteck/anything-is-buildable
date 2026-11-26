# HNU Student Portal (بوابة طلاب جامعة حلوان الأهلية)

Admin-managed Student Information System & Portal for **Helwan National University (HNU)** built with React 19, TypeScript, TanStack Start / Router / Query, Tailwind CSS v4, Nitro, and Supabase (PostgreSQL, Auth, Storage, RLS).

## Environment Variables

Configure the following environment variables in `.env` (local) or Vercel Project Settings (production). Never expose `SUPABASE_SERVICE_ROLE_KEY` in `VITE_*` variables or commit `.env`.

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Public (browser/build) | Supabase project URL used by browser client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public (browser/build) | Supabase anon/publishable key used by browser client |
| `SUPABASE_URL` | Server runtime | Supabase project URL used by server functions & middleware |
| `SUPABASE_PUBLISHABLE_KEY` | Server runtime | Supabase publishable key used for user-scoped JWT verification & ephemeral auth client |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret (server-only) | Trusted admin mutations, RPCs, signed URLs, and upload verification |

## Database Migrations (Apply in Exact Order)

Apply the forward-only SQL migrations in Supabase SQL Editor (or PostgreSQL CLI) strictly in ascending numeric order:

1. `drizzle/migrations/0000_migration.sql`
2. `drizzle/migrations/0001_migration.sql`
3. `drizzle/migrations/0002_migration.sql`
4. `drizzle/migrations/0003_migration.sql`
5. `drizzle/migrations/0004_migration.sql`
6. `drizzle/migrations/0005_migration.sql`
7. `drizzle/migrations/0006_login_rpc.sql`

After deploying with `SUPABASE_SERVICE_ROLE_KEY` configured on Vercel, you may optionally restrict `public.resolve_login_email(text)` to `service_role` in Supabase SQL Editor:
`revoke execute on function public.resolve_login_email(text) from anon, authenticated;`

## Supabase Auth Redirect URLs

Add the following allowed Redirect URLs in Supabase Dashboard → Authentication → URL Configuration:
- `http://localhost:8080/auth/callback` (local dev)
- `https://<your-vercel-domain>/auth/callback` (preview & production)

## Local Development & Verification

```sh
npm ci
npm run dev
npx tsc --noEmit
npm test
npm run build
```

See [`كتالوج.html`](./كتالوج.html) for the complete interactive Arabic RTL user manual, architecture reference, and step-by-step Supabase + Vercel deployment guide.
