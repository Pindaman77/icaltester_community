# Start now — iCal Tester Community Edition

Get the app running and sign in so you can create mock calendars and test iCal sync.

## Prerequisites

- **Node.js** and **npm**
- **Supabase**: either a [Supabase](https://supabase.com) project (hosted) or **Docker** + **Supabase CLI** (local)

## 1. Clone and install

```sh
git clone <YOUR_GIT_URL>
cd icaltester_community
npm install
```

## 2. Environment

```sh
cp .env.example .env
```

Edit `.env` and set at least:

- **Local Supabase (Docker)**  
  After running `supabase start`, copy from the CLI output:
  - `VITE_SUPABASE_URL` — API URL (e.g. `http://127.0.0.1:54321`)
  - `VITE_SUPABASE_PUBLISHABLE_KEY` — anon key  
  Optionally: `VITE_SUPABASE_FUNCTIONS_URL` (e.g. `http://127.0.0.1:54321/functions/v1`).

- **Hosted Supabase**  
  From your project: Settings → API:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_FUNCTIONS_URL` (e.g. `https://<project-ref>.supabase.co/functions/v1`)

Do not commit `.env`; it is in `.gitignore`.

## 3. Run the app

**Option A — Local Supabase (Docker)**

```sh
supabase start
supabase db reset
npm run dev
```

If you have a single-command script:

```sh
npm run local
```

Then open **http://localhost:5173**. In another terminal, run `npx supabase functions serve` if you need the ICS feed and sync.

**Option B — Hosted Supabase**

```sh
npm run dev
```

Open **http://localhost:5173**.

## 4. Sign up and sign in

- **First time**: open the app → **Sign up** → enter any email and password (for local, no verification is required).
- **Next times**: use **Sign in** with the same email and password. Your session is stored in the browser; you only need to sign in again if you use another browser or clear site data.
- **Google login**: works only when Supabase and Google Cloud are configured with the correct redirect URL (usually for a hosted/production URL). For local development, use email/password.

## 5. Next steps

- Create a calendar from the dashboard.
- Use the public feed URL for your calendar to test iCal sync.
- See the main [README.md](README.md) for migrations, edge functions, and deployment.
