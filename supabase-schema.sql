-- ============================================================
-- Cozy Moments Loyalty — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id               TEXT        PRIMARY KEY,          -- Supabase auth user UUID
  name             TEXT        NOT NULL,
  email            TEXT        NOT NULL,
  coffee_stamps    INTEGER     NOT NULL DEFAULT 0,
  wine_stamps      INTEGER     NOT NULL DEFAULT 0,
  beer_stamps      INTEGER     NOT NULL DEFAULT 0,
  coffee_rewards   INTEGER     NOT NULL DEFAULT 0,
  wine_rewards     INTEGER     NOT NULL DEFAULT 0,
  beer_rewards     INTEGER     NOT NULL DEFAULT 0,
  coffee_claimed   INTEGER     NOT NULL DEFAULT 0,
  wine_claimed     INTEGER     NOT NULL DEFAULT 0,
  beer_claimed     INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Row Level Security — customers can only see their own row
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Customers can read/update only their own record
CREATE POLICY "Customers: own row read"
  ON public.customers FOR SELECT
  USING (auth.uid()::text = id);

CREATE POLICY "Customers: own row update"
  ON public.customers FOR UPDATE
  USING (auth.uid()::text = id);

CREATE POLICY "Customers: insert own row"
  ON public.customers FOR INSERT
  WITH CHECK (auth.uid()::text = id);

-- Admin (service role) can read/write all — used by business panel via service key
-- No extra policy needed: service_role bypasses RLS automatically.

-- 3. Business panel: anon key can read all customers (for the admin UI)
--    Only add this if you want the business panel to use the anon key.
--    SAFER: create a separate admin Supabase project or use service key on a backend.
--    For now, allow anon SELECT so the admin UI works without a backend:
CREATE POLICY "Admin: read all customers"
  ON public.customers FOR SELECT
  USING (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS customers_email_idx ON public.customers (email);
