ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS partner_first_name TEXT;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS partner_birthday_day INTEGER;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS partner_birthday_month INTEGER;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS partner_birthday_year INTEGER;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_partner_birthday_day_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_partner_birthday_day_check
  CHECK (partner_birthday_day IS NULL OR partner_birthday_day BETWEEN 1 AND 31);

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_partner_birthday_month_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_partner_birthday_month_check
  CHECK (partner_birthday_month IS NULL OR partner_birthday_month BETWEEN 1 AND 12);

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_partner_birthday_year_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_partner_birthday_year_check
  CHECK (partner_birthday_year IS NULL OR partner_birthday_year BETWEEN 1900 AND EXTRACT(YEAR FROM NOW())::INTEGER);

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_partner_birthday_complete_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_partner_birthday_complete_check
  CHECK (
    (partner_first_name IS NULL AND partner_birthday_day IS NULL AND partner_birthday_month IS NULL AND partner_birthday_year IS NULL)
    OR (partner_first_name IS NOT NULL AND partner_birthday_day IS NOT NULL AND partner_birthday_month IS NOT NULL)
  );

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_partner_birthday_valid_date_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_partner_birthday_valid_date_check
  CHECK (
    partner_birthday_day IS NULL
    OR partner_birthday_day <= CASE partner_birthday_month
      WHEN 2 THEN 29
      WHEN 4 THEN 30
      WHEN 6 THEN 30
      WHEN 9 THEN 30
      WHEN 11 THEN 30
      ELSE 31
    END
  );

CREATE INDEX IF NOT EXISTS customers_partner_birthday_month_day_idx
  ON public.customers (partner_birthday_month, partner_birthday_day)
  WHERE partner_birthday_month IS NOT NULL AND partner_birthday_day IS NOT NULL;