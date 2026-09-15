# Fantasy NASCAR HQ

Fantasy NASCAR web app supporting two league types — Pick'em and Tiered
Draft — with versioned scoring rules. Built on Next.js (App Router) and
Prisma against Postgres.

## Stack

- Next.js 16 (App Router, TypeScript)
- Prisma 7 ORM, `@prisma/adapter-pg` driver adapter, `pg` for the Postgres
  connection
- Postgres (bring your own — Neon, Supabase, Railway, etc.)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set `DATABASE_URL` to your Postgres
   connection string:

   ```bash
   cp .env.example .env
   ```

3. Apply the schema to your database:

   ```bash
   npm run db:migrate
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The homepage
   queries the database directly to confirm the connection is working.

## Prisma notes

- `prisma/schema.prisma` — the data model (Users, Leagues, versioned
  RuleSets, Seasons, Races, Drivers, Tiers, Picks, Scores).
- `prisma7.config.ts` — Prisma 7 moved the datasource connection URL out of
  the schema file and into this config file; it reads `DATABASE_URL` from
  the environment.
- `src/lib/prisma.ts` — the app's `PrismaClient` singleton, constructed
  with the `@prisma/adapter-pg` driver adapter (required at runtime in
  Prisma 7).
- `prisma/migrations/` — the initial migration, generated from the schema
  with `prisma migrate diff` (no live database was available while
  scaffolding this project, so it wasn't created with `migrate dev`).
  Review it, then run `npm run db:migrate` (`prisma migrate deploy`)
  against a real database.

Useful scripts:

```bash
npm run db:migrate      # apply migrations (prisma migrate deploy)
npm run db:migrate:dev  # create + apply a new migration from schema changes
npm run db:studio       # browse data in Prisma Studio
```

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel (Next.js is
   auto-detected).
2. In the Vercel project's Environment Variables, set `DATABASE_URL` to
   your Postgres connection string (for all environments you plan to
   deploy).
3. Deploy. `npm install` runs `prisma generate` automatically via the
   `postinstall` script, so the client is always in sync with the schema.
4. Run `npm run db:migrate` against the production database (e.g. from
   your machine with `DATABASE_URL` pointed at production, or via the
   Vercel CLI/a one-off job) to create the tables. Migrations aren't run
   automatically as part of the build, so a fresh database won't have
   tables until you do this once.
