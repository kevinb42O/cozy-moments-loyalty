// @ts-nocheck

import { corsHeaders, extractAccessToken, getAdminClient, json, requireUser } from '../_shared/push.ts';

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Alleen POST wordt ondersteund.' }, 405);

    const adminClient = getAdminClient();
    const { error: authError, user } = await requireUser(adminClient, extractAccessToken(request.headers.get('Authorization')));
    if (authError) return authError;

    const body = await request.json();
    const customerId = normalizeString(body.customerId);
    const endpoint = normalizeString(body.subscription?.endpoint);
    const p256dh = normalizeString(body.subscription?.keys?.p256dh);
    const auth = normalizeString(body.subscription?.keys?.auth);
    const platform = normalizeString(body.platform).slice(0, 80) || null;
    const userAgent = normalizeString(body.userAgent).slice(0, 400) || null;
    const installedMode = ['browser', 'standalone', 'twa', 'unknown'].includes(body.installedMode) ? body.installedMode : 'unknown';

    if (!customerId || user.id !== customerId) return json({ error: 'Je mag alleen je eigen pushmeldingen beheren.' }, 403);
    if (!endpoint || !p256dh || !auth) return json({ error: 'Ongeldig push abonnement.' }, 400);

    const now = new Date().toISOString();

    const { data: preferences, error: preferenceError } = await adminClient
      .from('customer_push_preferences')
      .upsert({
        customer_id: customerId,
        push_enabled: true,
        reward_opt_in: true,
        reminder_opt_in: true,
        consent_source: 'customer-subscribe',
        consent_updated_at: now,
      }, { onConflict: 'customer_id' })
      .select('*')
      .single();

    if (preferenceError) return json({ error: preferenceError.message || 'Voorkeuren opslaan mislukt.' }, 400);

    const { data: subscription, error: subscriptionError } = await adminClient
      .from('customer_push_subscriptions')
      .upsert({
        customer_id: customerId,
        endpoint,
        p256dh,
        auth,
        platform,
        user_agent: userAgent,
        installed_mode: installedMode,
        is_active: true,
        last_seen_at: now,
        last_error_at: null,
        last_error_reason: null,
      }, { onConflict: 'endpoint' })
      .select('*')
      .single();

    if (subscriptionError) return json({ error: subscriptionError.message || 'Push abonnement opslaan mislukt.' }, 400);

    return json({ preferences, subscription });
  } catch (error) {
    console.error('register-push-subscription failed', error);
    return json({ error: error instanceof Error ? error.message : 'Onverwachte serverfout.' }, 500);
  }
});
