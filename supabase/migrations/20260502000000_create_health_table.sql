-- ============================================================
-- GMIS — Health table for keep-alive pings
-- This table exists solely to give the keep-alive Edge Function
-- a lightweight query target that resets Supabase's inactivity
-- timer on the free tier.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.health (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed one row so SELECT always finds a result immediately.
INSERT INTO public.health (id) VALUES (gen_random_uuid());

-- RLS: public read-only — no sensitive data here.
ALTER TABLE public.health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_health"
  ON public.health
  FOR SELECT
  TO public
  USING (true);
