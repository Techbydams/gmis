# Supabase Keep-Alive Setup

Prevents your free-tier Supabase project from auto-pausing after 7 days of inactivity.
The system pings an Edge Function every 15 minutes via GitHub Actions (or cron-job.org).

---

## How it works

1. A Supabase Edge Function (`keep-alive`) runs a lightweight DB query
2. A scheduler (GitHub Actions or cron-job.org) calls the function every 15 minutes
3. The DB query resets Supabase's inactivity timer, preventing auto-pause

---

## Step 1 — Apply the health table migration

Run this once to create the `health` table in your Supabase project:

**Option A — Supabase dashboard (easiest)**
1. Go to your [Supabase dashboard](https://supabase.com/dashboard)
2. Select your project (`lwcwfofplegdgdsvwbus`)
3. Open **SQL Editor**
4. Paste the contents of `supabase/migrations/YYYYMMDD_create_health_table.sql`
5. Click **Run**

**Option B — Supabase CLI**
```bash
cd GMIS
supabase db push
```

---

## Step 2 — Deploy the Edge Function

### Prerequisites
Install the Supabase CLI if you haven't already:
```bash
npm install -g supabase
```

### Login and link
```bash
supabase login
supabase link --project-ref lwcwfofplegdgdsvwbus
```

### Deploy
```bash
supabase functions deploy keep-alive --no-verify-jwt
```

The `--no-verify-jwt` flag allows the cron scheduler to call the function
without an auth token (it's a public ping endpoint — no sensitive data is exposed).

### Get your function URL
After deploying, your URL will be:
```
https://lwcwfofplegdgdsvwbus.supabase.co/functions/v1/keep-alive
```

Test it works:
```bash
curl https://lwcwfofplegdgdsvwbus.supabase.co/functions/v1/keep-alive
```

Expected response:
```json
{ "status": "alive", "timestamp": "2026-05-02T...", "db": "ok" }
```

---

## Step 3 — GitHub Actions (recommended)

### Add the repository secret
1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `SUPABASE_KEEPALIVE_URL`
5. Value: `https://lwcwfofplegdgdsvwbus.supabase.co/functions/v1/keep-alive`
6. Click **Add secret**

### Verify the workflow runs
1. Go to the **Actions** tab in your repository
2. Find **Keep Supabase Alive**
3. Click **Run workflow** to trigger it manually
4. Check the logs — you should see `Supabase project is alive.`

The workflow will then run automatically every 15 minutes.

---

## Step 4 — cron-job.org (alternative to GitHub Actions)

Use this if you don't want to rely on GitHub Actions or if the repo is private.

1. Go to [cron-job.org](https://cron-job.org) and create a free account
2. Click **Create cronjob**
3. Fill in:
   - **Title**: `GMIS Supabase Keep-Alive`
   - **URL**: `https://lwcwfofplegdgdsvwbus.supabase.co/functions/v1/keep-alive`
   - **Schedule**: Every 15 minutes
     - Click **Custom** and set: `*/15 * * * *`
   - **Request method**: `GET`
4. Click **Create**

To verify it's working:
- Wait 15 minutes, then click your job in the dashboard
- Open **Execution history**
- Status should be `0` (success) and response should contain `"status":"alive"`

---

## Step 5 — Verify in Supabase dashboard

1. Go to your [Supabase project](https://supabase.com/dashboard/project/lwcwfofplegdgdsvwbus)
2. Open **Edge Functions** in the left sidebar
3. Click **keep-alive**
4. Open the **Logs** tab
5. You should see a new log entry every 15 minutes with status `200`

To check if the DB query ran:
1. Open **SQL Editor**
2. Run: `SELECT * FROM health;`
3. You should see 1 row with a `created_at` timestamp

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `curl: (22) The requested URL returned error: 404` | Function not deployed — run `supabase functions deploy keep-alive --no-verify-jwt` |
| `curl: (22) The requested URL returned error: 401` | Re-deploy with `--no-verify-jwt` flag |
| Response has `"db": "error: ..."` | Health table doesn't exist — run the migration from Step 1 |
| GitHub Action fails | Check that `SUPABASE_KEEPALIVE_URL` secret is set correctly |
| Project still pauses | Upgrade to Supabase Pro ($25/mo) — the only 100% guaranteed solution |

---

## Files reference

| File | Purpose |
|------|---------|
| `supabase/functions/keep-alive/index.ts` | Edge Function source |
| `supabase/migrations/*_create_health_table.sql` | Health table migration |
| `.github/workflows/supabase-keepalive.yml` | GitHub Actions scheduler |
