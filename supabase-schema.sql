-- ============================================================
-- Cozy Moments Loyalty — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id               TEXT        PRIMARY KEY,          -- Supabase auth user UUID
  name             TEXT        NOT NULL,
  email            TEXT        NOT NULL DEFAULT '', -- Contact email shown in the UI; may stay blank for managed accounts
  login_email      TEXT        NOT NULL DEFAULT '', -- Actual auth login identifier
  login_alias      TEXT,
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
  must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
  loyalty_points   INTEGER     NOT NULL DEFAULT 0,
  loyalty_tier     TEXT        NOT NULL DEFAULT 'bronze' CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'vip')),
  created_by_admin_email TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customers
  ALTER COLUMN email SET DEFAULT '';

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS login_email TEXT NOT NULL DEFAULT '';

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS login_alias TEXT;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS created_by_admin_email TEXT;

UPDATE public.customers
SET login_email = COALESCE(NULLIF(login_email, ''), email)
WHERE COALESCE(login_email, '') = '';

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS loyalty_tier TEXT NOT NULL DEFAULT 'bronze';

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_loyalty_tier_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_loyalty_tier_check CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'vip'));

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

-- Step 1: Admin users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  email TEXT PRIMARY KEY,
  auth_user_id UUID,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_admin_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- No public RLS policies = table locked from client API.
-- Only the SECURITY DEFINER function below can read it.

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS created_by_admin_email TEXT;

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.admin_users AS admins
SET auth_user_id = COALESCE(admins.auth_user_id, users.id),
    display_name = COALESCE(
      NULLIF(admins.display_name, ''),
      NULLIF(users.raw_user_meta_data->>'display_name', ''),
      NULLIF(users.raw_user_meta_data->>'full_name', ''),
      admins.display_name
    )
FROM auth.users AS users
WHERE lower(users.email) = lower(admins.email)
  AND (
    admins.auth_user_id IS NULL
    OR COALESCE(NULLIF(admins.display_name, ''), '') = ''
  );

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_auth_user_id_uidx
  ON public.admin_users (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Step 2: Helper function that checks if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE COALESCE(is_active, TRUE)
      AND (
        auth.uid() = auth_user_id
        OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      )
  );
$$;

-- Step 3: Admin policies (replace the old USING(true) policies)
CREATE POLICY "Admin: read all customers"
  ON public.customers FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin: update all customers"
  ON public.customers FOR UPDATE
  USING (is_admin());

-- 3b. Transaction history for scans, redeems and manual corrections
CREATE TABLE IF NOT EXISTS public.customer_transactions (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id          TEXT        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  event_type           TEXT        NOT NULL CHECK (event_type IN ('scan', 'redeem', 'adjustment')),
  staff_email          TEXT,
  reason               TEXT,
  tx_id                TEXT,
  coffee_stamp_delta   INTEGER     NOT NULL DEFAULT 0,
  wine_stamp_delta     INTEGER     NOT NULL DEFAULT 0,
  beer_stamp_delta     INTEGER     NOT NULL DEFAULT 0,
  soda_stamp_delta     INTEGER     NOT NULL DEFAULT 0,
  coffee_reward_delta  INTEGER     NOT NULL DEFAULT 0,
  wine_reward_delta    INTEGER     NOT NULL DEFAULT 0,
  beer_reward_delta    INTEGER     NOT NULL DEFAULT 0,
  soda_reward_delta    INTEGER     NOT NULL DEFAULT 0,
  coffee_claimed_delta INTEGER     NOT NULL DEFAULT 0,
  wine_claimed_delta   INTEGER     NOT NULL DEFAULT 0,
  beer_claimed_delta   INTEGER     NOT NULL DEFAULT 0,
  soda_claimed_delta   INTEGER     NOT NULL DEFAULT 0,
  visit_delta          INTEGER     NOT NULL DEFAULT 0,
  metadata             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customer_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Transactions: customers read own" ON public.customer_transactions;
DROP POLICY IF EXISTS "Transactions: customers insert own" ON public.customer_transactions;
DROP POLICY IF EXISTS "Transactions: admin read all" ON public.customer_transactions;
DROP POLICY IF EXISTS "Transactions: admin insert all" ON public.customer_transactions;

CREATE POLICY "Transactions: customers read own"
  ON public.customer_transactions FOR SELECT
  USING (auth.uid()::text = customer_id);

CREATE POLICY "Transactions: customers insert own"
  ON public.customer_transactions FOR INSERT
  WITH CHECK (auth.uid()::text = customer_id);

CREATE POLICY "Transactions: admin read all"
  ON public.customer_transactions FOR SELECT
  USING (is_admin());

CREATE POLICY "Transactions: admin insert all"
  ON public.customer_transactions FOR INSERT
  WITH CHECK (is_admin());

-- ⚠️  IMPORTANT: After running this schema, run these two extra queries:
--
-- 1. Add your first admin to the whitelist:
--    INSERT INTO admin_users (email, display_name) VALUES ('your-admin@email.com', 'Voornaam Naam');
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

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS open_bottles JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS promo_open_bottle_product_id TEXT;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS promo_drink_menu_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS screensaver_config JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS drink_menu_sections JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS active_promos JSONB NOT NULL DEFAULT '[]'::jsonb;

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

-- Optional but recommended for the admin screensaver editor:
-- create storage bucket `screensaver-assets` as a public bucket in Supabase Storage.
-- The app overwrites fixed filenames per slide slot, so storage use stays bounded.

-- 5. Loyalty tier helpers (Bronze / Silver / Gold / VIP)
CREATE OR REPLACE FUNCTION public.calculate_customer_loyalty_points(
  p_coffee_stamps INTEGER,
  p_wine_stamps INTEGER,
  p_beer_stamps INTEGER,
  p_soda_stamps INTEGER,
  p_coffee_rewards INTEGER,
  p_wine_rewards INTEGER,
  p_beer_rewards INTEGER,
  p_soda_rewards INTEGER,
  p_coffee_claimed INTEGER,
  p_wine_claimed INTEGER,
  p_beer_claimed INTEGER,
  p_soda_claimed INTEGER
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    GREATEST(COALESCE(p_coffee_stamps, 0), 0)
    + GREATEST(COALESCE(p_wine_stamps, 0), 0)
    + GREATEST(COALESCE(p_beer_stamps, 0), 0)
    + GREATEST(COALESCE(p_soda_stamps, 0), 0)
    + ((GREATEST(COALESCE(p_coffee_rewards, 0), 0) + GREATEST(COALESCE(p_coffee_claimed, 0), 0)) * 12)
    + ((GREATEST(COALESCE(p_wine_rewards, 0), 0) + GREATEST(COALESCE(p_wine_claimed, 0), 0)) * 12)
    + ((GREATEST(COALESCE(p_beer_rewards, 0), 0) + GREATEST(COALESCE(p_beer_claimed, 0), 0)) * 12)
    + ((GREATEST(COALESCE(p_soda_rewards, 0), 0) + GREATEST(COALESCE(p_soda_claimed, 0), 0)) * 12);
$$;

CREATE OR REPLACE FUNCTION public.calculate_customer_loyalty_tier(p_loyalty_points INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_loyalty_points, 0) >= 150 THEN 'vip'
    WHEN COALESCE(p_loyalty_points, 0) >= 75 THEN 'gold'
    WHEN COALESCE(p_loyalty_points, 0) >= 25 THEN 'silver'
    ELSE 'bronze'
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_customer_loyalty_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.loyalty_points := public.calculate_customer_loyalty_points(
    NEW.coffee_stamps,
    NEW.wine_stamps,
    NEW.beer_stamps,
    NEW.soda_stamps,
    NEW.coffee_rewards,
    NEW.wine_rewards,
    NEW.beer_rewards,
    NEW.soda_rewards,
    NEW.coffee_claimed,
    NEW.wine_claimed,
    NEW.beer_claimed,
    NEW.soda_claimed
  );
  NEW.loyalty_tier := public.calculate_customer_loyalty_tier(NEW.loyalty_points);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_sync_loyalty_fields ON public.customers;
CREATE TRIGGER customers_sync_loyalty_fields
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_loyalty_fields();

UPDATE public.customers
SET
  loyalty_points = public.calculate_customer_loyalty_points(
    coffee_stamps,
    wine_stamps,
    beer_stamps,
    soda_stamps,
    coffee_rewards,
    wine_rewards,
    beer_rewards,
    soda_rewards,
    coffee_claimed,
    wine_claimed,
    beer_claimed,
    soda_claimed
  ),
  loyalty_tier = public.calculate_customer_loyalty_tier(
    public.calculate_customer_loyalty_points(
      coffee_stamps,
      wine_stamps,
      beer_stamps,
      soda_stamps,
      coffee_rewards,
      wine_rewards,
      beer_rewards,
      soda_rewards,
      coffee_claimed,
      wine_claimed,
      beer_claimed,
      soda_claimed
    )
  )
WHERE loyalty_points IS DISTINCT FROM public.calculate_customer_loyalty_points(
  coffee_stamps,
  wine_stamps,
  beer_stamps,
  soda_stamps,
  coffee_rewards,
  wine_rewards,
  beer_rewards,
  soda_rewards,
  coffee_claimed,
  wine_claimed,
  beer_claimed,
  soda_claimed
)
OR loyalty_tier IS DISTINCT FROM public.calculate_customer_loyalty_tier(
  public.calculate_customer_loyalty_points(
    coffee_stamps,
    wine_stamps,
    beer_stamps,
    soda_stamps,
    coffee_rewards,
    wine_rewards,
    beer_rewards,
    soda_rewards,
    coffee_claimed,
    wine_claimed,
    beer_claimed,
    soda_claimed
  )
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS customers_email_idx ON public.customers (email);
CREATE INDEX IF NOT EXISTS customers_login_email_idx ON public.customers (login_email);
CREATE UNIQUE INDEX IF NOT EXISTS customers_login_alias_uidx ON public.customers (login_alias) WHERE login_alias IS NOT NULL AND login_alias <> '';
CREATE INDEX IF NOT EXISTS customers_loyalty_tier_idx ON public.customers (loyalty_tier);
CREATE INDEX IF NOT EXISTS customers_loyalty_points_idx ON public.customers (loyalty_points DESC);
CREATE INDEX IF NOT EXISTS customer_transactions_customer_created_idx ON public.customer_transactions (customer_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS customer_transactions_tx_id_uidx ON public.customer_transactions (tx_id) WHERE tx_id IS NOT NULL;

-- 6c. Public keepalive RPC for external cron services
CREATE OR REPLACE FUNCTION public.keepalive_ping()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ok', TRUE,
    'project', 'cozy-moments-loyalty',
    'ts', NOW()
  );
$$;

REVOKE ALL ON FUNCTION public.keepalive_ping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keepalive_ping() TO anon, authenticated, service_role;

-- 6b. RPC: apply a signed scan exactly once and log it in the history
CREATE OR REPLACE FUNCTION public.apply_customer_scan(
  p_customer_id TEXT,
  p_tx_id TEXT,
  p_staff_email TEXT,
  p_coffee INTEGER DEFAULT 0,
  p_wine INTEGER DEFAULT 0,
  p_beer INTEGER DEFAULT 0,
  p_soda INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_row public.customers%ROWTYPE;
  requested_coffee INTEGER := GREATEST(COALESCE(p_coffee, 0), 0);
  requested_wine   INTEGER := GREATEST(COALESCE(p_wine, 0), 0);
  requested_beer   INTEGER := GREATEST(COALESCE(p_beer, 0), 0);
  requested_soda   INTEGER := GREATEST(COALESCE(p_soda, 0), 0);
  actual_coffee INTEGER := requested_coffee;
  actual_wine   INTEGER := requested_wine;
  actual_beer   INTEGER := requested_beer;
  actual_soda   INTEGER := requested_soda;
  coffee_rewards_earned INTEGER := 0;
  wine_rewards_earned   INTEGER := 0;
  beer_rewards_earned   INTEGER := 0;
  soda_rewards_earned   INTEGER := 0;
  bonus_applied BOOLEAN := FALSE;
  bonus_type TEXT := NULL;
  next_last_visit TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid()::text <> p_customer_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Niet geautoriseerd';
  END IF;

  IF COALESCE(NULLIF(TRIM(p_tx_id), ''), '') = '' THEN
    RAISE EXCEPTION 'Ontbrekende transactie-ID';
  END IF;

  IF requested_coffee + requested_wine + requested_beer + requested_soda <= 0 THEN
    RAISE EXCEPTION 'Geen consumpties opgegeven';
  END IF;

  IF EXISTS (SELECT 1 FROM public.customer_transactions WHERE tx_id = p_tx_id) THEN
    RAISE EXCEPTION 'Deze QR code is al verwerkt';
  END IF;

  SELECT * INTO customer_row
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klant niet gevonden';
  END IF;

  IF NOT customer_row.welcome_bonus_claimed THEN
    IF actual_coffee > 0 THEN
      actual_coffee := actual_coffee + 2;
      bonus_type := 'coffee';
      bonus_applied := TRUE;
    ELSIF actual_wine > 0 THEN
      actual_wine := actual_wine + 2;
      bonus_type := 'wine';
      bonus_applied := TRUE;
    ELSIF actual_beer > 0 THEN
      actual_beer := actual_beer + 2;
      bonus_type := 'beer';
      bonus_applied := TRUE;
    ELSIF actual_soda > 0 THEN
      actual_soda := actual_soda + 2;
      bonus_type := 'soda';
      bonus_applied := TRUE;
    END IF;
  END IF;

  coffee_rewards_earned := FLOOR((customer_row.coffee_stamps + actual_coffee) / 12.0);
  wine_rewards_earned   := FLOOR((customer_row.wine_stamps + actual_wine) / 12.0);
  beer_rewards_earned   := FLOOR((customer_row.beer_stamps + actual_beer) / 12.0);
  soda_rewards_earned   := FLOOR((customer_row.soda_stamps + actual_soda) / 12.0);

  UPDATE public.customers
  SET
    coffee_stamps = MOD(customer_row.coffee_stamps + actual_coffee, 12),
    wine_stamps = MOD(customer_row.wine_stamps + actual_wine, 12),
    beer_stamps = MOD(customer_row.beer_stamps + actual_beer, 12),
    soda_stamps = MOD(customer_row.soda_stamps + actual_soda, 12),
    coffee_rewards = customer_row.coffee_rewards + coffee_rewards_earned,
    wine_rewards = customer_row.wine_rewards + wine_rewards_earned,
    beer_rewards = customer_row.beer_rewards + beer_rewards_earned,
    soda_rewards = customer_row.soda_rewards + soda_rewards_earned,
    total_visits = customer_row.total_visits + 1,
    last_visit_at = next_last_visit,
    welcome_bonus_claimed = customer_row.welcome_bonus_claimed OR bonus_applied,
    bonus_card_type = CASE
      WHEN bonus_applied THEN bonus_type
      WHEN customer_row.bonus_card_type = 'coffee' AND coffee_rewards_earned > 0 THEN NULL
      WHEN customer_row.bonus_card_type = 'wine' AND wine_rewards_earned > 0 THEN NULL
      WHEN customer_row.bonus_card_type = 'beer' AND beer_rewards_earned > 0 THEN NULL
      WHEN customer_row.bonus_card_type = 'soda' AND soda_rewards_earned > 0 THEN NULL
      ELSE customer_row.bonus_card_type
    END
  WHERE id = p_customer_id;

  INSERT INTO public.customer_transactions (
    customer_id,
    event_type,
    staff_email,
    reason,
    tx_id,
    coffee_stamp_delta,
    wine_stamp_delta,
    beer_stamp_delta,
    soda_stamp_delta,
    coffee_reward_delta,
    wine_reward_delta,
    beer_reward_delta,
    soda_reward_delta,
    visit_delta,
    metadata
  )
  VALUES (
    p_customer_id,
    'scan',
    NULLIF(TRIM(p_staff_email), ''),
    CASE WHEN bonus_applied THEN 'Welkomstbonus automatisch toegepast' ELSE NULL END,
    p_tx_id,
    actual_coffee,
    actual_wine,
    actual_beer,
    actual_soda,
    coffee_rewards_earned,
    wine_rewards_earned,
    beer_rewards_earned,
    soda_rewards_earned,
    1,
    jsonb_build_object(
      'requested', jsonb_build_object('coffee', requested_coffee, 'wine', requested_wine, 'beer', requested_beer, 'soda', requested_soda),
      'applied', jsonb_build_object('coffee', actual_coffee, 'wine', actual_wine, 'beer', actual_beer, 'soda', actual_soda),
      'earned', jsonb_build_object('coffee', coffee_rewards_earned, 'wine', wine_rewards_earned, 'beer', beer_rewards_earned, 'soda', soda_rewards_earned),
      'bonusApplied', bonus_applied,
      'bonusType', bonus_type
    )
  );

  RETURN jsonb_build_object(
    'earned', jsonb_build_object('coffee', coffee_rewards_earned, 'wine', wine_rewards_earned, 'beer', beer_rewards_earned, 'soda', soda_rewards_earned),
    'bonusApplied', bonus_applied,
    'bonusType', bonus_type,
    'lastVisitAt', next_last_visit
  );
END;
$$;

-- 5c. RPC: claim a reward exactly once and log it in the history
CREATE OR REPLACE FUNCTION public.claim_customer_reward(
  p_customer_id TEXT,
  p_card_type TEXT,
  p_tx_id TEXT,
  p_staff_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_row public.customers%ROWTYPE;
  normalized_type TEXT := LOWER(COALESCE(p_card_type, ''));
BEGIN
  IF auth.uid()::text <> p_customer_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Niet geautoriseerd';
  END IF;

  IF normalized_type NOT IN ('coffee', 'wine', 'beer', 'soda') THEN
    RAISE EXCEPTION 'Ongeldig kaarttype';
  END IF;

  IF COALESCE(NULLIF(TRIM(p_tx_id), ''), '') = '' THEN
    RAISE EXCEPTION 'Ontbrekende transactie-ID';
  END IF;

  IF EXISTS (SELECT 1 FROM public.customer_transactions WHERE tx_id = p_tx_id) THEN
    RAISE EXCEPTION 'Deze QR code is al verwerkt';
  END IF;

  SELECT * INTO customer_row
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klant niet gevonden';
  END IF;

  IF normalized_type = 'coffee' AND customer_row.coffee_rewards <= 0 THEN
    RAISE EXCEPTION 'Geen gratis koffie beschikbaar';
  ELSIF normalized_type = 'wine' AND customer_row.wine_rewards <= 0 THEN
    RAISE EXCEPTION 'Geen gratis wijn beschikbaar';
  ELSIF normalized_type = 'beer' AND customer_row.beer_rewards <= 0 THEN
    RAISE EXCEPTION 'Geen gratis bier beschikbaar';
  ELSIF normalized_type = 'soda' AND customer_row.soda_rewards <= 0 THEN
    RAISE EXCEPTION 'Geen gratis frisdrank beschikbaar';
  END IF;

  UPDATE public.customers
  SET
    coffee_rewards = customer_row.coffee_rewards - CASE WHEN normalized_type = 'coffee' THEN 1 ELSE 0 END,
    wine_rewards = customer_row.wine_rewards - CASE WHEN normalized_type = 'wine' THEN 1 ELSE 0 END,
    beer_rewards = customer_row.beer_rewards - CASE WHEN normalized_type = 'beer' THEN 1 ELSE 0 END,
    soda_rewards = customer_row.soda_rewards - CASE WHEN normalized_type = 'soda' THEN 1 ELSE 0 END,
    coffee_claimed = customer_row.coffee_claimed + CASE WHEN normalized_type = 'coffee' THEN 1 ELSE 0 END,
    wine_claimed = customer_row.wine_claimed + CASE WHEN normalized_type = 'wine' THEN 1 ELSE 0 END,
    beer_claimed = customer_row.beer_claimed + CASE WHEN normalized_type = 'beer' THEN 1 ELSE 0 END,
    soda_claimed = customer_row.soda_claimed + CASE WHEN normalized_type = 'soda' THEN 1 ELSE 0 END
  WHERE id = p_customer_id;

  INSERT INTO public.customer_transactions (
    customer_id,
    event_type,
    staff_email,
    tx_id,
    coffee_reward_delta,
    wine_reward_delta,
    beer_reward_delta,
    soda_reward_delta,
    coffee_claimed_delta,
    wine_claimed_delta,
    beer_claimed_delta,
    soda_claimed_delta,
    metadata
  )
  VALUES (
    p_customer_id,
    'redeem',
    NULLIF(TRIM(p_staff_email), ''),
    p_tx_id,
    CASE WHEN normalized_type = 'coffee' THEN -1 ELSE 0 END,
    CASE WHEN normalized_type = 'wine' THEN -1 ELSE 0 END,
    CASE WHEN normalized_type = 'beer' THEN -1 ELSE 0 END,
    CASE WHEN normalized_type = 'soda' THEN -1 ELSE 0 END,
    CASE WHEN normalized_type = 'coffee' THEN 1 ELSE 0 END,
    CASE WHEN normalized_type = 'wine' THEN 1 ELSE 0 END,
    CASE WHEN normalized_type = 'beer' THEN 1 ELSE 0 END,
    CASE WHEN normalized_type = 'soda' THEN 1 ELSE 0 END,
    jsonb_build_object('cardType', normalized_type)
  );

  RETURN jsonb_build_object('cardType', normalized_type);
END;
$$;

-- 5d. RPC: apply a manual correction and log the reason + medewerker
CREATE OR REPLACE FUNCTION public.apply_manual_adjustment(
  p_customer_id TEXT,
  p_staff_email TEXT,
  p_reason TEXT,
  p_coffee_stamps INTEGER DEFAULT 0,
  p_wine_stamps INTEGER DEFAULT 0,
  p_beer_stamps INTEGER DEFAULT 0,
  p_soda_stamps INTEGER DEFAULT 0,
  p_coffee_rewards INTEGER DEFAULT 0,
  p_wine_rewards INTEGER DEFAULT 0,
  p_beer_rewards INTEGER DEFAULT 0,
  p_soda_rewards INTEGER DEFAULT 0,
  p_coffee_claimed INTEGER DEFAULT 0,
  p_wine_claimed INTEGER DEFAULT 0,
  p_beer_claimed INTEGER DEFAULT 0,
  p_soda_claimed INTEGER DEFAULT 0,
  p_visit_delta INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_row public.customers%ROWTYPE;
  next_coffee_stamps INTEGER;
  next_wine_stamps INTEGER;
  next_beer_stamps INTEGER;
  next_soda_stamps INTEGER;
  next_coffee_rewards INTEGER;
  next_wine_rewards INTEGER;
  next_beer_rewards INTEGER;
  next_soda_rewards INTEGER;
  next_coffee_claimed INTEGER;
  next_wine_claimed INTEGER;
  next_beer_claimed INTEGER;
  next_soda_claimed INTEGER;
  next_total_visits INTEGER;
  next_last_visit TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Niet geautoriseerd';
  END IF;

  IF COALESCE(NULLIF(TRIM(p_reason), ''), '') = '' THEN
    RAISE EXCEPTION 'Een reden is verplicht';
  END IF;

  SELECT * INTO customer_row
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klant niet gevonden';
  END IF;

  next_coffee_stamps := customer_row.coffee_stamps + COALESCE(p_coffee_stamps, 0);
  next_wine_stamps := customer_row.wine_stamps + COALESCE(p_wine_stamps, 0);
  next_beer_stamps := customer_row.beer_stamps + COALESCE(p_beer_stamps, 0);
  next_soda_stamps := customer_row.soda_stamps + COALESCE(p_soda_stamps, 0);
  next_coffee_rewards := customer_row.coffee_rewards + COALESCE(p_coffee_rewards, 0);
  next_wine_rewards := customer_row.wine_rewards + COALESCE(p_wine_rewards, 0);
  next_beer_rewards := customer_row.beer_rewards + COALESCE(p_beer_rewards, 0);
  next_soda_rewards := customer_row.soda_rewards + COALESCE(p_soda_rewards, 0);
  next_coffee_claimed := customer_row.coffee_claimed + COALESCE(p_coffee_claimed, 0);
  next_wine_claimed := customer_row.wine_claimed + COALESCE(p_wine_claimed, 0);
  next_beer_claimed := customer_row.beer_claimed + COALESCE(p_beer_claimed, 0);
  next_soda_claimed := customer_row.soda_claimed + COALESCE(p_soda_claimed, 0);
  next_total_visits := customer_row.total_visits + COALESCE(p_visit_delta, 0);

  IF next_coffee_stamps < 0 OR next_coffee_stamps > 11
     OR next_wine_stamps < 0 OR next_wine_stamps > 11
     OR next_beer_stamps < 0 OR next_beer_stamps > 11
     OR next_soda_stamps < 0 OR next_soda_stamps > 11 THEN
    RAISE EXCEPTION 'Stempels op de huidige kaart moeten tussen 0 en 11 blijven';
  END IF;

  IF next_coffee_rewards < 0 OR next_wine_rewards < 0 OR next_beer_rewards < 0 OR next_soda_rewards < 0 THEN
    RAISE EXCEPTION 'Beloningen kunnen niet negatief worden';
  END IF;

  IF next_coffee_claimed < 0 OR next_wine_claimed < 0 OR next_beer_claimed < 0 OR next_soda_claimed < 0 THEN
    RAISE EXCEPTION 'Ingewisselde beloningen kunnen niet negatief worden';
  END IF;

  IF next_total_visits < 0 THEN
    RAISE EXCEPTION 'Bezoeken kunnen niet negatief worden';
  END IF;

  next_last_visit := CASE
    WHEN next_total_visits = 0 THEN NULL
    WHEN COALESCE(p_visit_delta, 0) > 0 THEN NOW()
    ELSE customer_row.last_visit_at
  END;

  UPDATE public.customers
  SET
    coffee_stamps = next_coffee_stamps,
    wine_stamps = next_wine_stamps,
    beer_stamps = next_beer_stamps,
    soda_stamps = next_soda_stamps,
    coffee_rewards = next_coffee_rewards,
    wine_rewards = next_wine_rewards,
    beer_rewards = next_beer_rewards,
    soda_rewards = next_soda_rewards,
    coffee_claimed = next_coffee_claimed,
    wine_claimed = next_wine_claimed,
    beer_claimed = next_beer_claimed,
    soda_claimed = next_soda_claimed,
    total_visits = next_total_visits,
    last_visit_at = next_last_visit
  WHERE id = p_customer_id;

  INSERT INTO public.customer_transactions (
    customer_id,
    event_type,
    staff_email,
    reason,
    coffee_stamp_delta,
    wine_stamp_delta,
    beer_stamp_delta,
    soda_stamp_delta,
    coffee_reward_delta,
    wine_reward_delta,
    beer_reward_delta,
    soda_reward_delta,
    coffee_claimed_delta,
    wine_claimed_delta,
    beer_claimed_delta,
    soda_claimed_delta,
    visit_delta,
    metadata
  )
  VALUES (
    p_customer_id,
    'adjustment',
    NULLIF(TRIM(p_staff_email), ''),
    TRIM(p_reason),
    COALESCE(p_coffee_stamps, 0),
    COALESCE(p_wine_stamps, 0),
    COALESCE(p_beer_stamps, 0),
    COALESCE(p_soda_stamps, 0),
    COALESCE(p_coffee_rewards, 0),
    COALESCE(p_wine_rewards, 0),
    COALESCE(p_beer_rewards, 0),
    COALESCE(p_soda_rewards, 0),
    COALESCE(p_coffee_claimed, 0),
    COALESCE(p_wine_claimed, 0),
    COALESCE(p_beer_claimed, 0),
    COALESCE(p_soda_claimed, 0),
    COALESCE(p_visit_delta, 0),
    jsonb_build_object('lastVisitAtUpdated', COALESCE(p_visit_delta, 0) > 0)
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- 6. Merge duplicate customers (same email, different auth provider)
-- Called from the app after each login to auto-fix Google vs email duplicates.
CREATE OR REPLACE FUNCTION public.merge_customer_by_email(new_id TEXT, new_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old RECORD;
BEGIN
  -- Find existing customer with same email but different auth id
  SELECT * INTO old FROM public.customers
    WHERE COALESCE(NULLIF(login_email, ''), email) = new_email AND id <> new_id
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Merge: add old stamps/rewards/claimed/visits into the new row
  UPDATE public.customers SET
    email            = CASE WHEN COALESCE(NULLIF(email, ''), '') <> '' THEN email ELSE COALESCE(old.email, '') END,
    login_email      = COALESCE(NULLIF(login_email, ''), NULLIF(old.login_email, ''), old.email, ''),
    login_alias      = COALESCE(login_alias, old.login_alias),
    coffee_stamps   = coffee_stamps   + old.coffee_stamps,
    wine_stamps     = wine_stamps     + old.wine_stamps,
    beer_stamps     = beer_stamps     + old.beer_stamps,
    soda_stamps     = soda_stamps     + old.soda_stamps,
    coffee_rewards  = coffee_rewards  + old.coffee_rewards,
    wine_rewards    = wine_rewards    + old.wine_rewards,
    beer_rewards    = beer_rewards    + old.beer_rewards,
    soda_rewards    = soda_rewards    + old.soda_rewards,
    coffee_claimed  = coffee_claimed  + old.coffee_claimed,
    wine_claimed    = wine_claimed    + old.wine_claimed,
    beer_claimed    = beer_claimed    + old.beer_claimed,
    soda_claimed    = soda_claimed    + old.soda_claimed,
    total_visits    = total_visits    + old.total_visits,
    last_visit_at   = GREATEST(last_visit_at, old.last_visit_at),
    welcome_bonus_claimed = welcome_bonus_claimed OR old.welcome_bonus_claimed,
    must_reset_password = must_reset_password OR old.must_reset_password,
    created_by_admin_email = COALESCE(created_by_admin_email, old.created_by_admin_email),
    created_at      = LEAST(created_at, old.created_at)
  WHERE id = new_id;

  -- Delete the old duplicate row
  DELETE FROM public.customers WHERE id = old.id;
END;
$$;

-- 5. Migration: Add visit tracking columns (run if upgrading existing installation)
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_visits INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;

-- 6. Migration: Add welcome bonus column (run if upgrading existing installation)
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS welcome_bonus_claimed BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bonus_card_type TEXT;

-- 7. Migration: Add loyalty tier columns (run if upgrading existing installation)
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_tier TEXT NOT NULL DEFAULT 'bronze';

-- 8. Admin function: Delete a customer completely (customers row + auth user)
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
