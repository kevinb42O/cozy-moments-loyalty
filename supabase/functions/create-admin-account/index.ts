// @ts-nocheck

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function extractAccessToken(authHeader: string | null) {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function isDuplicateAuthError(error: { message?: string | null } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('already been registered') || message.includes('already exists');
}

function createTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `CozyAdmin-${suffix}`;
}

async function requireAdmin(adminClient: ReturnType<typeof createClient>, accessToken: string) {
  const { data: requesterData, error: requesterError } = await adminClient.auth.getUser(accessToken);
  const requesterEmail = requesterData.user?.email?.trim().toLowerCase() ?? '';

  if (requesterError || !requesterData.user || !requesterEmail) {
    console.error('Admin session validation failed', requesterError);
    return { error: json({ error: 'Je sessie is ongeldig. Log opnieuw in als admin.' }, 401), requesterEmail: '' };
  }

  const { data: adminRows, error: adminLookupError } = await adminClient
    .from('admin_users')
    .select('email, is_active');

  if (adminLookupError) {
    console.error('Admin lookup failed', adminLookupError);
    return { error: json({ error: 'Admincontrole mislukte. Probeer opnieuw.' }, 500), requesterEmail };
  }

  const adminRecord = (adminRows ?? []).find((record) => normalizeEmail(record.email) === requesterEmail) ?? null;

  if (!adminRecord || adminRecord.is_active === false) {
    return { error: json({ error: `Dit adminaccount staat niet actief in admin_users: ${requesterEmail}` }, 403), requesterEmail };
  }

  return { error: null, requesterEmail };
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Alleen POST wordt ondersteund.' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const accessToken = extractAccessToken(request.headers.get('Authorization'));

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing required Edge Function env vars', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return json({ error: 'Supabase Edge Function is niet volledig geconfigureerd.' }, 500);
    }

    if (!accessToken) {
      return json({ error: 'Niet geautoriseerd.' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error: adminError, requesterEmail } = await requireAdmin(adminClient, accessToken);
    if (adminError) {
      return adminError;
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return json({ error: 'Ongeldige request body.' }, 400);
    }

    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const email = normalizeEmail(body.email);

    if (displayName.length < 2) {
      return json({ error: 'Geef minstens een herkenbare naam in.' }, 400);
    }

    if (!isValidEmail(email)) {
      return json({ error: 'Geef een geldig e-mailadres in.' }, 400);
    }

    const { data: existingAdmins, error: existingAdminError } = await adminClient
      .from('admin_users')
      .select('email');

    if (existingAdminError) {
      console.error('Admin duplicate lookup failed', existingAdminError);
      return json({ error: 'Bestaande admins controleren mislukt.' }, 500);
    }

    if ((existingAdmins ?? []).some((record) => normalizeEmail(record.email) === email)) {
      return json({ error: 'Er bestaat al een admin met dit e-mailadres.' }, 409);
    }

    const temporaryPassword = createTemporaryPassword();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: displayName,
        display_name: displayName,
      },
      app_metadata: {
        role: 'admin',
      },
    });

    if (authError) {
      console.error('Admin auth user creation failed', { email, authError });

      if (isDuplicateAuthError(authError)) {
        return json({ error: 'Er bestaat al een auth-account met dit e-mailadres.' }, 409);
      }

      return json({ error: authError.message || 'Het admin auth-account kon niet aangemaakt worden.' }, 400);
    }

    const createdUser = authData.user;

    if (!createdUser) {
      return json({ error: 'Supabase gaf geen nieuwe admingebruiker terug.' }, 500);
    }

    const { data: insertedAdmin, error: insertError } = await adminClient
      .from('admin_users')
      .insert({
        email,
        display_name: displayName,
        auth_user_id: createdUser.id,
        created_by_admin_email: requesterEmail,
        is_active: true,
      })
      .select('email, display_name, auth_user_id, created_at, created_by_admin_email, is_active')
      .single();

    if (insertError) {
      console.error('Admin record insert failed', { email, insertError });
      await adminClient.auth.admin.deleteUser(createdUser.id);

      if (insertError.code === '23505') {
        return json({ error: 'Er bestaat al een admin met dit e-mailadres.' }, 409);
      }

      return json({ error: insertError.message || 'De admin kon niet in de database opgeslagen worden.' }, 400);
    }

    return json({
      email: insertedAdmin.email,
      displayName: insertedAdmin.display_name ?? displayName,
      authUserId: insertedAdmin.auth_user_id ?? createdUser.id,
      createdAt: insertedAdmin.created_at,
      createdByAdminEmail: insertedAdmin.created_by_admin_email ?? requesterEmail,
      isActive: insertedAdmin.is_active !== false,
      temporaryPassword,
    }, 201);
  } catch (unexpectedError) {
    console.error('Unexpected create-admin-account failure', unexpectedError);
    const message = unexpectedError instanceof Error ? unexpectedError.message : 'Onverwachte serverfout.';
    return json({ error: message }, 500);
  }
});
