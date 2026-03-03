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

-- Drop existing policies if they exist (safe to re-run)
DROP POLICY IF EXISTS "Customers: own row read"   ON public.customers;
DROP POLICY IF EXISTS "Customers: own row update" ON public.customers;
DROP POLICY IF EXISTS "Customers: insert own row" ON public.customers;
DROP POLICY IF EXISTS "Admin: read all customers" ON public.customers;
DROP POLICY IF EXISTS "Admin: update all customers" ON public.customers;

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

-- 3. Business panel: anon key can read AND update all customers
CREATE POLICY "Admin: read all customers"
  ON public.customers FOR SELECT
  USING (true);

CREATE POLICY "Admin: update all customers"
  ON public.customers FOR UPDATE
  USING (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS customers_email_idx ON public.customers (email);
