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

CREATE INDEX IF NOT EXISTS customers_login_email_idx ON public.customers (login_email);

CREATE UNIQUE INDEX IF NOT EXISTS customers_login_alias_uidx
  ON public.customers (login_alias)
  WHERE login_alias IS NOT NULL AND login_alias <> '';

CREATE OR REPLACE FUNCTION public.merge_customer_by_email(new_id TEXT, new_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old RECORD;
BEGIN
  SELECT * INTO old FROM public.customers
    WHERE COALESCE(NULLIF(login_email, ''), email) = new_email AND id <> new_id
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.customers SET
    email = CASE WHEN COALESCE(NULLIF(email, ''), '') <> '' THEN email ELSE COALESCE(old.email, '') END,
    login_email = COALESCE(NULLIF(login_email, ''), NULLIF(old.login_email, ''), old.email, ''),
    login_alias = COALESCE(login_alias, old.login_alias),
    coffee_stamps = coffee_stamps + old.coffee_stamps,
    wine_stamps = wine_stamps + old.wine_stamps,
    beer_stamps = beer_stamps + old.beer_stamps,
    soda_stamps = soda_stamps + old.soda_stamps,
    coffee_rewards = coffee_rewards + old.coffee_rewards,
    wine_rewards = wine_rewards + old.wine_rewards,
    beer_rewards = beer_rewards + old.beer_rewards,
    soda_rewards = soda_rewards + old.soda_rewards,
    coffee_claimed = coffee_claimed + old.coffee_claimed,
    wine_claimed = wine_claimed + old.wine_claimed,
    beer_claimed = beer_claimed + old.beer_claimed,
    soda_claimed = soda_claimed + old.soda_claimed,
    total_visits = total_visits + old.total_visits,
    last_visit_at = GREATEST(last_visit_at, old.last_visit_at),
    welcome_bonus_claimed = welcome_bonus_claimed OR old.welcome_bonus_claimed,
    must_reset_password = must_reset_password OR old.must_reset_password,
    created_by_admin_email = COALESCE(created_by_admin_email, old.created_by_admin_email),
    created_at = LEAST(created_at, old.created_at)
  WHERE id = new_id;

  DELETE FROM public.customers WHERE id = old.id;
END;
$$;
