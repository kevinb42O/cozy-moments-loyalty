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
