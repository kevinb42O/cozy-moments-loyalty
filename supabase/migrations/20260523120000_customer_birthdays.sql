ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS birthday_day INTEGER;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS birthday_month INTEGER;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS birthday_year INTEGER;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_birthday_day_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_birthday_day_check
  CHECK (birthday_day IS NULL OR birthday_day BETWEEN 1 AND 31);

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_birthday_month_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_birthday_month_check
  CHECK (birthday_month IS NULL OR birthday_month BETWEEN 1 AND 12);

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_birthday_year_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_birthday_year_check
  CHECK (birthday_year IS NULL OR birthday_year BETWEEN 1900 AND EXTRACT(YEAR FROM NOW())::INTEGER);

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_birthday_complete_month_day_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_birthday_complete_month_day_check
  CHECK (
    (birthday_day IS NULL AND birthday_month IS NULL)
    OR (birthday_day IS NOT NULL AND birthday_month IS NOT NULL)
  );

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_birthday_valid_date_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_birthday_valid_date_check
  CHECK (
    birthday_day IS NULL
    OR birthday_day <= CASE birthday_month
      WHEN 2 THEN 29
      WHEN 4 THEN 30
      WHEN 6 THEN 30
      WHEN 9 THEN 30
      WHEN 11 THEN 30
      ELSE 31
    END
  );

CREATE INDEX IF NOT EXISTS customers_birthday_month_day_idx
  ON public.customers (birthday_month, birthday_day)
  WHERE birthday_month IS NOT NULL AND birthday_day IS NOT NULL;