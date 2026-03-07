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
  soda_stamps      INTEGER     NOT NULL DEFAULT 0,
  coffee_rewards   INTEGER     NOT NULL DEFAULT 0,
  wine_rewards     INTEGER     NOT NULL DEFAULT 0,
  beer_rewards     INTEGER     NOT NULL DEFAULT 0,
  soda_rewards     INTEGER     NOT NULL DEFAULT 0,
  coffee_claimed   INTEGER     NOT NULL DEFAULT 0,
  wine_claimed     INTEGER     NOT NULL DEFAULT 0,
  beer_claimed     INTEGER     NOT NULL DEFAULT 0,
  soda_claimed     INTEGER     NOT NULL DEFAULT 0,
  total_visits     INTEGER     NOT NULL DEFAULT 0,
  last_visit_at    TIMESTAMPTZ,
  welcome_bonus_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  bonus_card_type  TEXT,
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

-- 3. Admin access — only authenticated admin users can read/modify all customers

-- Step 1: Admin users table (add admin emails via SQL Editor)
CREATE TABLE IF NOT EXISTS public.admin_users (
  email TEXT PRIMARY KEY
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- No public RLS policies = table locked from client API.
-- Only the SECURITY DEFINER function below can read it.

-- Step 2: Helper function that checks if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE email = (auth.jwt() ->> 'email')
  );
$$;

-- Step 3: Admin policies (replace the old USING(true) policies)
CREATE POLICY "Admin: read all customers"
  ON public.customers FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin: update all customers"
  ON public.customers FOR UPDATE
  USING (is_admin());

-- ⚠️  IMPORTANT: After running this schema, run these two extra queries:
--
-- 1. Add your admin email to the whitelist:
--    INSERT INTO admin_users (email) VALUES ('your-admin@email.com');
--
-- 2. Create the admin user in Supabase Auth:
--    Go to: Authentication → Users → Add User
--    Email: your-admin@email.com
--    Password: (choose a strong password)
--    That same password is used to log in to the admin panel.

-- 4. Site settings (single-row table for promo message etc.)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id             TEXT        PRIMARY KEY DEFAULT 'default',
  promo_message  TEXT        NOT NULL DEFAULT '',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the single default row
INSERT INTO public.site_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read the settings (customers need the promo)
DROP POLICY IF EXISTS "Settings: anyone can read" ON public.site_settings;
CREATE POLICY "Settings: anyone can read"
  ON public.site_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can update the settings
DROP POLICY IF EXISTS "Settings: admin can update" ON public.site_settings;
CREATE POLICY "Settings: admin can update"
  ON public.site_settings FOR UPDATE
  USING (is_admin());

-- 5. Indexes
CREATE INDEX IF NOT EXISTS customers_email_idx ON public.customers (email);

-- 5. Migration: Add visit tracking columns (run if upgrading existing installation)
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_visits INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;

-- 6. Migration: Add welcome bonus column (run if upgrading existing installation)
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS welcome_bonus_claimed BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bonus_card_type TEXT;

-- 7. Admin function: Delete a customer completely (customers row + auth user)
--    Only callable by admin users (checked inside the function).
CREATE OR REPLACE FUNCTION public.delete_customer_account(customer_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the caller is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Niet geautoriseerd';
  END IF;

  -- Delete from public.customers
  DELETE FROM public.customers WHERE id = customer_id;

  -- Delete from auth.users (requires SECURITY DEFINER to access auth schema)
  DELETE FROM auth.users WHERE id = customer_id::uuid;
END;
$$;
