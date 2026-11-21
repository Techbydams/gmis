// ============================================================
// GMIS — Keep-Alive Edge Function
// Keeps the Supabase project active on the free tier by
// running a lightweight DB query on a schedule.
// Deploy: supabase functions deploy keep-alive --no-verify-jwt
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req: Request): Promise<Response> => {
  const timestamp = new Date().toISOString();

  // Initialize Supabase client using service role key so the
  // health table query works even if RLS is enabled.
  const supabaseUrl     = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    // Still return 200 so the cron considers it alive — env vars
    // are missing only in misconfigured deployments.
    return new Response(
      JSON.stringify({
        status:    "alive",
        timestamp,
        db:        "skipped",
        warning:   "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set",
      }),
      {
        status:  200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Run lightweight query — just fetches 1 row from the health table.
  // This wakes Postgres if it was sleeping and resets the inactivity timer.
  let dbStatus = "ok";
  try {
    const { error } = await supabase
      .from("health")
      .select("id")
      .limit(1);

    if (error) {
      // Log the error but still return 200 — the ping itself succeeded.
      console.error("[keep-alive] DB query error:", error.message);
      dbStatus = `error: ${error.message}`;
    }
  } catch (err) {
    console.error("[keep-alive] Unexpected error:", err);
    dbStatus = `exception: ${String(err)}`;
  }

  return new Response(
    JSON.stringify({
      status:    "alive",
      timestamp,
      db:        dbStatus,
    }),
    {
      status:  200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
