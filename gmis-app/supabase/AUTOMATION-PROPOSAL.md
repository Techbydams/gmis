# GMIS — Institution Provisioning Automation

## Current Manual Flow (what happens today)

1. Institution submits registration form → `organizations` row created (`status = pending`)
2. Platform admin reviews in admin panel → manually sets `status = approved`
3. DB trigger `on_org_approved` fires → `provision_org_features()` inserts feature toggles
4. **THEN: Everything stops.** Nobody creates the Supabase project, runs the SQL,
   or sets `supabase_url` / `supabase_anon_key` on the org row.
5. Platform admin must manually create a Supabase project, run `tenant-setup.sql`,
   copy the URL + keys back into the `organizations` record.

This is ~15–20 minutes of manual work per institution and is error-prone.

---

## Proposed Automated Flow

When the platform admin clicks "Approve" in the admin panel:

```
Admin clicks Approve
      │
      ▼
PLATFORM DB: organizations.status → 'approved'
      │
      ▼ (trigger: on_org_approved)
provision_org_features() ← already works ✓
      │
      ▼ (new: Edge Function webhook)
Edge Function: provision-institution
      │
      ├─ 1. Create Supabase project via Management API
      ├─ 2. Wait for project to be ACTIVE (~30s polling)
      ├─ 3. Execute tenant-setup.sql via DB connection
      ├─ 4. Create the first super_admin Auth user
      ├─ 5. Update organizations row with URL, anon key, service key
      ├─ 6. Send welcome email to admin_email
      └─ 7. Log to audit_logs
```

---

## Implementation Plan

### Step 1 — Edge Function: `provision-institution`

Create `supabase/functions/provision-institution/index.ts`.

**Trigger:** Called by the `on_org_approved` DB trigger via a
`pg_net` HTTP call, OR called manually from the platform admin panel.

**What it needs:**
- `SUPABASE_MANAGEMENT_API_KEY` (from your Supabase account, not project)
- `PLATFORM_SERVICE_ROLE_KEY` (to update the `organizations` row)
- `SMTP_*` env vars for sending welcome email

**Pseudocode:**
```typescript
// 1. Get org details from platform DB
const org = await platformDb.from('organizations').select('*').eq('id', orgId).single()

// 2. Create Supabase project via Management API
const project = await fetch('https://api.supabase.com/v1/projects', {
  method: 'POST',
  headers: { Authorization: `Bearer ${MANAGEMENT_API_KEY}` },
  body: JSON.stringify({
    name: `gmis-${org.slug}`,
    organization_id: SUPABASE_ORG_ID,
    plan: 'free',
    region: 'ap-southeast-1',  // nearest to Nigeria
    db_pass: generateStrongPassword(),
  })
})

// 3. Poll until project is ACTIVE (can take 30–90s)
await waitForProjectReady(project.id)

// 4. Get project API keys
const keys = await fetch(`https://api.supabase.com/v1/projects/${project.id}/api-keys`)
const anonKey    = keys.find(k => k.name === 'anon')?.api_key
const serviceKey = keys.find(k => k.name === 'service_role')?.api_key

// 5. Run tenant-setup.sql on the new project
const tenantDb = createClient(project.endpoint, serviceKey)
await tenantDb.rpc('exec_sql', { sql: TENANT_SETUP_SQL })
// (or use pg connection string directly with postgres.js)

// 6. Update organizations record
await platformDb.from('organizations').update({
  supabase_project_id: project.id,
  supabase_url:        project.endpoint,
  supabase_anon_key:   anonKey,
  supabase_service_key: serviceKey,  // encrypt with Vault before storing
}).eq('id', orgId)

// 7. Create first super_admin auth user in the new project
const adminAuth = createClient(project.endpoint, serviceKey)
const { data: authUser } = await adminAuth.auth.admin.createUser({
  email:    org.admin_email,
  password: generateTempPassword(),
  email_confirm: true,
})
await tenantDb.from('admin_users').insert({
  supabase_uid: authUser.user.id,
  email:        org.admin_email,
  full_name:    org.admin_name,
  role:         'super_admin',
})

// 8. Send welcome email
await sendWelcomeEmail({ org, tempPassword })

// 9. Audit log
await platformDb.from('audit_logs').insert({
  action: 'institution_provisioned',
  org_id: org.id,
  details: { project_id: project.id }
})
```

### Step 2 — Trigger the Edge Function from `on_org_approved`

Use `pg_net` extension (available in Supabase) to call the Edge Function
from the DB trigger:

```sql
-- Enable pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Update on_org_approved trigger to call the Edge Function
CREATE OR REPLACE FUNCTION public.on_org_approved()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Provision features immediately (sync)
    PERFORM provision_org_features(NEW.id);

    -- Trigger async provisioning Edge Function
    PERFORM net.http_post(
      url     := 'https://arbgvtpjcvfcckepdhef.supabase.co/functions/v1/provision-institution',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', TRUE)
      ),
      body    := jsonb_build_object('org_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;
```

### Step 3 — Supabase Management API access

You need a **Personal Access Token** (not a project API key) to call
`api.supabase.com/v1/*`. Create one at:
https://supabase.com/dashboard/account/tokens

Store it as an Edge Function secret:
```bash
supabase secrets set SUPABASE_MANAGEMENT_API_KEY=sbp_...
supabase secrets set SUPABASE_ORG_ID=bmhkqqzflsrcfjszeolf
```

### Step 4 — Deploy the Edge Function

```bash
cd gmis-app
supabase functions deploy provision-institution --project-ref arbgvtpjcvfcckepdhef
```

---

## Alternative: Semi-Automated (Simpler, Less Risk)

Instead of fully automatic provisioning, the admin panel could:

1. Platform admin approves institution (manual, as today)
2. A second button appears: **"Provision Portal"**
3. Admin clicks it → calls the Edge Function directly from the app
4. Edge Function does steps 1–8 above
5. Admin sees real-time status in a modal

**Pros:** More control, no risk of auto-creating projects for mis-approved orgs
**Cons:** Still requires admin action; not fully hands-off

---

## My Recommendation

**Use the semi-automated approach first** (Step 4 button in the admin panel).

Reasons:
- Supabase project creation costs money — you want a human to confirm
- The Management API call is async and can fail; a UI is easier to debug
- You can add the full trigger automation later once you trust the flow
- Nigerian context: institutions often have edge cases (polytechnic vs. university
  grading, special configurations) that need human review before go-live

**What to implement now:**
1. Run `platform-security-fixes.sql` — close the RLS gaps
2. Run `tenant-setup.sql` on each new institution manually until automation is ready
3. Build the "Provision Portal" button in the admin panel (Step 8 of the roadmap)
4. Build the Edge Function for that button

---

## Estimated Work

| Task | Effort |
|------|--------|
| Run security fix SQL (both DBs) | 10 min |
| Build `provision-institution` Edge Function | 1 day |
| Add "Provision" button to admin panel | 2 hrs |
| Set up pg_cron for auto-lock | 20 min |
| Enable leaked password protection | 5 min |
| Encrypt service key with Vault | 2 hrs |
