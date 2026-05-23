ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_partner_first_name_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_partner_first_name_check
  CHECK (
    partner_first_name IS NULL
    OR (
      partner_first_name = btrim(partner_first_name)
      AND char_length(partner_first_name) BETWEEN 2 AND 40
      AND partner_first_name !~ '[[:space:]]'
    )
  );