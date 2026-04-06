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

function extractAccessToken(authHeader: string | null) {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireAdmin(adminClient: ReturnType<typeof createClient>, accessToken: string) {
  const { data: requesterData, error: requesterError } = await adminClient.auth.getUser(accessToken);
  const requesterEmail = requesterData.user?.email?.trim().toLowerCase() ?? '';

  if (requesterError || !requesterData.user || !requesterEmail) {
    console.error('Admin session validation failed', requesterError);
    return json({ error: 'Je sessie is ongeldig. Log opnieuw in als admin.' }, 401);
  }

  const { data: adminRows, error: adminLookupError } = await adminClient
    .from('admin_users')
    .select('email, is_active');

  if (adminLookupError) {
    console.error('Admin lookup failed', adminLookupError);
    return json({ error: 'Admincontrole mislukte. Probeer opnieuw.' }, 500);
  }

  const adminRecord = (adminRows ?? []).find((record) => record.email?.trim().toLowerCase() === requesterEmail) ?? null;

  if (!adminRecord || adminRecord.is_active === false) {
    return json({ error: `Dit adminaccount staat niet actief in admin_users: ${requesterEmail}` }, 403);
  }

  return null;
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

    const adminError = await requireAdmin(adminClient, accessToken);
    if (adminError) {
      return adminError;
    }

    const { data, error } = await adminClient
      .from('admin_users')
      .select('email, display_name, auth_user_id, created_at, created_by_admin_email, is_active')
      .order('created_at', { ascending: false })
      .order('email', { ascending: true });

    if (error) {
      console.error('Admin list lookup failed', error);
      return json({ error: 'Adminoverzicht laden mislukt.' }, 500);
    }

    return json({
      admins: (data ?? []).map((record) => ({
        email: record.email,
        displayName: record.display_name ?? null,
        authUserId: record.auth_user_id ?? null,
        createdAt: record.created_at,
        createdByAdminEmail: record.created_by_admin_email ?? null,
        isActive: record.is_active !== false,
      })),
    });
  } catch (unexpectedError) {
    console.error('Unexpected list-admin-accounts failure', unexpectedError);
    const message = unexpectedError instanceof Error ? unexpectedError.message : 'Onverwachte serverfout.';
    return json({ error: message }, 500);
  }
});
