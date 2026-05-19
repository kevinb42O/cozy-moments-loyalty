-- Cozy Moments Loyalty — Push notifications

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS push_settings JSONB NOT NULL DEFAULT '{"disableAllPush":false,"promotionsPaused":false,"automations":{"rewardReady":true,"rewardReminder":true,"inactivityReminder":true}}'::jsonb;

CREATE TABLE IF NOT EXISTS public.customer_push_preferences (
  customer_id        TEXT PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  push_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  promo_opt_in       BOOLEAN NOT NULL DEFAULT FALSE,
  reward_opt_in      BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_opt_in    BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start  TIME NOT NULL DEFAULT '20:00',
  quiet_hours_end    TIME NOT NULL DEFAULT '10:00',
  muted_until        TIMESTAMPTZ,
  consent_source     TEXT,
  consent_updated_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_push_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  endpoint          TEXT NOT NULL,
  p256dh            TEXT NOT NULL,
  auth              TEXT NOT NULL,
  platform          TEXT,
  user_agent        TEXT,
  installed_mode    TEXT NOT NULL DEFAULT 'unknown' CHECK (installed_mode IN ('browser', 'standalone', 'twa', 'unknown')),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at      TIMESTAMPTZ,
  last_error_at     TIMESTAMPTZ,
  last_error_reason TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint)
);

CREATE TABLE IF NOT EXISTS public.push_campaigns (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_type          TEXT NOT NULL CHECK (campaign_type IN ('manual_custom', 'reward_ready', 'reward_reminder', 'inactivity_reminder', 'promo_open_bottle')),
  delivery_category      TEXT NOT NULL CHECK (delivery_category IN ('service', 'reward', 'reminder', 'promo')),
  template_key           TEXT,
  title                  TEXT NOT NULL,
  body                   TEXT NOT NULL,
  deeplink               TEXT NOT NULL DEFAULT '/dashboard',
  audience_mode          TEXT NOT NULL DEFAULT 'segment' CHECK (audience_mode IN ('all', 'segment', 'single')),
  audience_filters       JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_recipients   INTEGER NOT NULL DEFAULT 0,
  actual_recipients      INTEGER NOT NULL DEFAULT 0,
  sent_count             INTEGER NOT NULL DEFAULT 0,
  failure_count          INTEGER NOT NULL DEFAULT 0,
  click_count            INTEGER NOT NULL DEFAULT 0,
  status                 TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'failed')),
  created_by_admin_email TEXT,
  scheduled_for          TIMESTAMPTZ,
  sent_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_delivery_events (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id         UUID REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
  customer_id         TEXT REFERENCES public.customers(id) ON DELETE CASCADE,
  subscription_id     UUID REFERENCES public.customer_push_subscriptions(id) ON DELETE SET NULL,
  status              TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'clicked')),
  provider_message_id TEXT,
  opened_path         TEXT,
  error_code          TEXT,
  error_message       TEXT,
  clicked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_push_subscriptions_customer_idx
  ON public.customer_push_subscriptions (customer_id, is_active);

CREATE INDEX IF NOT EXISTS customer_push_preferences_enabled_idx
  ON public.customer_push_preferences (push_enabled, promo_opt_in, reward_opt_in, reminder_opt_in);

CREATE INDEX IF NOT EXISTS push_campaigns_created_idx
  ON public.push_campaigns (created_at DESC);

CREATE INDEX IF NOT EXISTS push_delivery_events_campaign_idx
  ON public.push_delivery_events (campaign_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS push_delivery_events_customer_idx
  ON public.push_delivery_events (customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_push_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_push_preferences_touch_updated_at ON public.customer_push_preferences;
CREATE TRIGGER customer_push_preferences_touch_updated_at
  BEFORE UPDATE ON public.customer_push_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_push_preferences_updated_at();

CREATE OR REPLACE FUNCTION public.touch_push_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_push_subscriptions_touch_updated_at ON public.customer_push_subscriptions;
CREATE TRIGGER customer_push_subscriptions_touch_updated_at
  BEFORE UPDATE ON public.customer_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_push_subscriptions_updated_at();

ALTER TABLE public.customer_push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_delivery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Push preferences: customers own read" ON public.customer_push_preferences;
DROP POLICY IF EXISTS "Push preferences: customers own insert" ON public.customer_push_preferences;
DROP POLICY IF EXISTS "Push preferences: customers own update" ON public.customer_push_preferences;
DROP POLICY IF EXISTS "Push preferences: admin read all" ON public.customer_push_preferences;

CREATE POLICY "Push preferences: customers own read"
  ON public.customer_push_preferences FOR SELECT
  USING (auth.uid()::text = customer_id);

CREATE POLICY "Push preferences: customers own insert"
  ON public.customer_push_preferences FOR INSERT
  WITH CHECK (auth.uid()::text = customer_id);

CREATE POLICY "Push preferences: customers own update"
  ON public.customer_push_preferences FOR UPDATE
  USING (auth.uid()::text = customer_id)
  WITH CHECK (auth.uid()::text = customer_id);

CREATE POLICY "Push preferences: admin read all"
  ON public.customer_push_preferences FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Push subscriptions: customers own read" ON public.customer_push_subscriptions;
DROP POLICY IF EXISTS "Push subscriptions: customers own insert" ON public.customer_push_subscriptions;
DROP POLICY IF EXISTS "Push subscriptions: customers own update" ON public.customer_push_subscriptions;
DROP POLICY IF EXISTS "Push subscriptions: admin read all" ON public.customer_push_subscriptions;

CREATE POLICY "Push subscriptions: customers own read"
  ON public.customer_push_subscriptions FOR SELECT
  USING (auth.uid()::text = customer_id);

CREATE POLICY "Push subscriptions: customers own insert"
  ON public.customer_push_subscriptions FOR INSERT
  WITH CHECK (auth.uid()::text = customer_id);

CREATE POLICY "Push subscriptions: customers own update"
  ON public.customer_push_subscriptions FOR UPDATE
  USING (auth.uid()::text = customer_id)
  WITH CHECK (auth.uid()::text = customer_id);

CREATE POLICY "Push subscriptions: admin read all"
  ON public.customer_push_subscriptions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Push campaigns: admin read all" ON public.push_campaigns;
DROP POLICY IF EXISTS "Push campaigns: admin insert" ON public.push_campaigns;
DROP POLICY IF EXISTS "Push campaigns: admin update" ON public.push_campaigns;

CREATE POLICY "Push campaigns: admin read all"
  ON public.push_campaigns FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Push campaigns: admin insert"
  ON public.push_campaigns FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Push campaigns: admin update"
  ON public.push_campaigns FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Push delivery events: admin read all" ON public.push_delivery_events;
DROP POLICY IF EXISTS "Push delivery events: customers own read" ON public.push_delivery_events;

CREATE POLICY "Push delivery events: admin read all"
  ON public.push_delivery_events FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Push delivery events: customers own read"
  ON public.push_delivery_events FOR SELECT
  USING (auth.uid()::text = customer_id);

CREATE OR REPLACE FUNCTION public.ensure_customer_push_preferences(p_customer_id TEXT)
RETURNS public.customer_push_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_row public.customer_push_preferences%ROWTYPE;
BEGIN
  IF auth.uid()::text <> p_customer_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Niet geautoriseerd';
  END IF;

  INSERT INTO public.customer_push_preferences (customer_id, consent_source)
  VALUES (p_customer_id, 'default')
  ON CONFLICT (customer_id) DO NOTHING;

  SELECT * INTO result_row
  FROM public.customer_push_preferences
  WHERE customer_id = p_customer_id;

  RETURN result_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_customer_push_preferences(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_customer_push_preferences(TEXT) TO authenticated;
