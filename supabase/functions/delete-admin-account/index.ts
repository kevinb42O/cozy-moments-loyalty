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

function isAuthUserMissingError(error: { message?: string | null } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('not found') || message.includes('no rows');
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

    const targetEmail = normalizeEmail(body.email);

    if (!isValidEmail(targetEmail)) {
      return json({ error: 'Geef een geldig e-mailadres in.' }, 400);
    }

    if (targetEmail === requesterEmail) {
      return json({ error: 'Je kunt jezelf niet verwijderen via dit scherm.' }, 400);
    }

    const { data: adminRows, error: adminListError } = await adminClient
      .from('admin_users')
      .select('email, auth_user_id, is_active, display_name, created_by_admin_email, created_at');

    if (adminListError) {
      console.error('Admin list lookup failed', adminListError);
      return json({ error: 'Adminoverzicht laden mislukt.' }, 500);
    }

    const targetAdmin = (adminRows ?? []).find((record) => normalizeEmail(record.email) === targetEmail) ?? null;

    if (!targetAdmin) {
      return json({ error: 'Dit adminaccount bestaat niet meer.' }, 404);
    }

    const activeAdmins = (adminRows ?? []).filter((record) => record.is_active !== false);
    if (targetAdmin.is_active !== false && activeAdmins.length <= 1) {
      return json({ error: 'Je kunt de laatste actieve admin niet verwijderen.' }, 400);
    }

    if (targetAdmin.auth_user_id) {
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetAdmin.auth_user_id);

      if (deleteAuthError && !isAuthUserMissingError(deleteAuthError)) {
        console.error('Auth admin deletion failed', { targetEmail, deleteAuthError });
        return json({ error: deleteAuthError.message || 'Het loginaccount kon niet verwijderd worden.' }, 500);
      }
    }

    const { error: deleteAdminError } = await adminClient
      .from('admin_users')
      .delete()
      .eq('email', targetAdmin.email);

    if (deleteAdminError) {
      console.error('Admin record deletion failed', { targetEmail, deleteAdminError });
      return json({ error: deleteAdminError.message || 'Het adminrecord kon niet verwijderd worden.' }, 500);
    }

    return json({
      email: normalizeEmail(targetAdmin.email),
      deleted: true,
    });
  } catch (unexpectedError) {
    console.error('Unexpected delete-admin-account failure', unexpectedError);
    const message = unexpectedError instanceof Error ? unexpectedError.message : 'Onverwachte serverfout.';
    return json({ error: message }, 500);
  }
});
