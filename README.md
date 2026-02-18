# iCal Tester Community Edition

Self-hosted iCal mock server for calendar sync testing. RFC 5545 compliant feeds for debugging Booking.com, Airbnb, VRBO, and PMS integrations.

## Community Edition scope

This `community` branch is the public self-hosted Community Edition.

Hosted/private editions may include additional platform features in a separate private branch/repo.

To **move this branch into a new repo** and use a **new database** (recommended for the Community Edition), see [Community repo and new database](docs/community-repo-and-new-database.md).

For migration strategy and archived history, see [Community baseline migrations](docs/community-baseline-migrations.md).

## Functionality

- **Auth**: Supabase Auth (magic link/password/OAuth depending on your Supabase configuration).
- **Calendars**: Create, rename, delete calendars; per-calendar public feed token.
- **Bookings**: Manual all-day bookings with statuses (confirmed, cancelled, tentative, pending).
- **Subscriptions**: Add external ICS URLs; enable/disable; poll interval; sync now; sync logs.
- **Public feed**: `GET /ics-feed/{token}`; rate limited; returns RFC 5545 ICS.
- **Timeline**: Cross-calendar visual timeline with overlap visibility.

## Tech stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (auth, database, edge functions)

## Getting started

### Prerequisites

- Node.js and npm
- Supabase project
- Supabase CLI (for migrations/functions)

### Run locally

```sh
git clone <YOUR_GIT_URL>
cd icaltester
npm i
cp .env.example .env
# edit .env values
npm run dev
```

### Environment and secrets

- **Do not commit `.env`.** It is listed in `.gitignore`. Use [.env.example](.env.example) as a template and keep real credentials only in your local or deployment environment.
- If any credentials were ever committed or exposed, **rotate them**: in Supabase (Dashboard → Settings → API) regenerate the anon key; set a new `ICS_CRON_SECRET` in Supabase Edge Function secrets and in your cron/scheduler config; then update production and CI env with the new values.
- **Old commits still visible on GitHub?** If you see a commit like `fd3f37f` with `.env` via a direct link, it is **orphaned** (not on any branch)—history was rewritten so `main` no longer contains it. GitHub may still show it from cache. To request removal from GitHub’s cache, see [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) and contact GitHub Support if needed. Regardless, treat any exposed credentials as compromised and rotate them.
- **Optional:** To block commits that add `.env`, use the repo hooks: from the repo root run `git config core.hooksPath .githooks`.

## Local setup

### Option A: Single-command local (recommended)

Run Supabase (Docker) and the app with one command. Requires Docker and Node.js.

```sh
npm run local
```

This starts Supabase in Docker, applies migrations, writes `.env`, and runs the dev server. Open **http://localhost:5173**. In a second terminal run `npx supabase functions serve` for the public ICS feed.

See **[docs/local-supabase-docker.md](docs/local-supabase-docker.md)** for manual steps, env vars, and troubleshooting.

### Option A2: Local Supabase (manual steps)

Run Supabase and the app step by step:

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli) and have Docker running.
2. Start the stack: `supabase start`
3. Apply migrations: `supabase db reset`
4. Copy the **API URL** and **anon key** from the CLI output into `.env` (see [Local Supabase with Docker](docs/local-supabase-docker.md)).
5. Run the app: `npm run dev`. For edge functions: `supabase functions serve`.

Full steps, env vars, and troubleshooting: **[docs/local-supabase-docker.md](docs/local-supabase-docker.md)**.

### Option B: Remote Supabase project

1. Create `.env` from `.env.example`.
2. Set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_FUNCTIONS_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `ICS_CRON_SECRET`
3. Link Supabase:
- `supabase link`
4. Apply database changes:
- `supabase db push`
5. Deploy required edge functions for community runtime:
- `supabase functions deploy ics-feed`
- `supabase functions deploy ics-sync`
- `supabase functions deploy ics_api`
- `supabase functions deploy ics_cron`

For cron setup and rotation without admin UI, see `docs/community-cron-runbook.md`.

## Database migrations

- Active, from-scratch community schema is consolidated into:
  - `supabase/migrations/20260218150000_community_baseline.sql`
- Historical migration chain is preserved in:
  - `supabase/migrations_archive/`
- Archived files are kept for reference only and are not applied during fresh setup.

## Scripts

| Command | Description |
| --- | --- |
| `npm run local` | One-command local: Supabase (Docker) + migrations + .env + dev server |
| `npm run dev` | Start dev server |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Deploying

Build with `npm run build` and deploy `dist/`. Configure proxying so `/ics-feed/*` resolves to Supabase Functions for your domain.

## License

License for public distribution is maintained by project owners. Add a `LICENSE` file before publishing this branch as open source.
