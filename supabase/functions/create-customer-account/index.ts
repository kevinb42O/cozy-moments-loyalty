// @ts-nocheck

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildManagedLoginAlias,
  buildManagedLoginEmail,
  TEMP_CUSTOMER_PASSWORD,
} from '../../../src/shared/lib/customer-accounts.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_MANAGED_ACCOUNT_ATTEMPTS = 6;

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

function createNumericSuffix() {
  return `${Math.floor(Math.random() * 9000) + 1000}`;
}

function isDuplicateAuthError(error: { message?: string | null } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('already been registered') || message.includes('already exists');
}

function extractAccessToken(authHeader: string | null) {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
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
    const authHeader = request.headers.get('Authorization');
    const accessToken = extractAccessToken(authHeader);

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

    const adminRecord = (adminRows ?? []).find((record) => normalizeEmail(record.email) === requesterEmail) ?? null;

    if (!adminRecord || adminRecord.is_active === false) {
      return json({ error: `Dit adminaccount staat niet actief in admin_users: ${requesterEmail}` }, 403);
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return json({ error: 'Ongeldige request body.' }, 400);
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const contactEmail = normalizeEmail(body.email);

    if (name.length < 2) {
      return json({ error: 'Geef minstens een herkenbare klantnaam in.' }, 400);
    }

    if (contactEmail && !isValidEmail(contactEmail)) {
      return json({ error: 'Het e-mailadres lijkt niet geldig.' }, 400);
    }

    const createdByAdminEmail = requesterEmail || null;
    const baseAlias = buildManagedLoginAlias(name);
    const attempts = contactEmail ? 1 : MAX_MANAGED_ACCOUNT_ATTEMPTS;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const loginAlias = contactEmail ? null : `${baseAlias}-${createNumericSuffix()}`;
      const loginEmail = contactEmail || buildManagedLoginEmail(loginAlias);

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: loginEmail,
        password: TEMP_CUSTOMER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          display_name: name,
        },
      });

      if (authError) {
        console.error('Auth user creation failed', { loginEmail, authError });

        if (!contactEmail && isDuplicateAuthError(authError) && attempt < attempts - 1) {
          continue;
        }

        if (contactEmail && isDuplicateAuthError(authError)) {
          return json({ error: 'Er bestaat al een account met dit e-mailadres.' }, 409);
        }

        return json({ error: authError.message || 'Het auth-account kon niet aangemaakt worden.' }, 400);
      }

      const createdUser = authData.user;

      if (!createdUser) {
        return json({ error: 'Supabase gaf geen nieuwe gebruiker terug.' }, 500);
      }

      const { error: insertError } = await adminClient.from('customers').insert({
        id: createdUser.id,
        name,
        email: contactEmail,
        login_email: loginEmail,
        login_alias: loginAlias,
        must_reset_password: true,
        created_by_admin_email: createdByAdminEmail,
      });

      if (insertError) {
        console.error('Customer insert failed', { loginEmail, insertError });
        await adminClient.auth.admin.deleteUser(createdUser.id);

        if (!contactEmail && insertError.code === '23505' && attempt < attempts - 1) {
          continue;
        }

        return json({ error: insertError.message || 'De klant kon niet in de database opgeslagen worden.' }, 400);
      }

      return json({
        customerId: createdUser.id,
        name,
        contactEmail: contactEmail || null,
        loginEmail,
        loginAlias,
        loginIdentifier: loginAlias || loginEmail,
        temporaryPassword: TEMP_CUSTOMER_PASSWORD,
        mustResetPassword: true,
        createdByAdminEmail,
      }, 201);
    }

    return json({ error: 'Kon geen unieke accountcode genereren. Probeer opnieuw.' }, 409);
  } catch (unexpectedError) {
    console.error('Unexpected create-customer-account failure', unexpectedError);
    const message = unexpectedError instanceof Error ? unexpectedError.message : 'Onverwachte serverfout.';
    return json({ error: message }, 500);
  }
});
