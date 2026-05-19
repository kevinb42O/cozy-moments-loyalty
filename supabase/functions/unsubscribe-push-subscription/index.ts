// @ts-nocheck

import { corsHeaders, extractAccessToken, getAdminClient, json, requireUser } from '../_shared/push.ts';

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Alleen POST wordt ondersteund.' }, 405);

    const adminClient = getAdminClient();
    const { error: authError, user } = await requireUser(adminClient, extractAccessToken(request.headers.get('Authorization')));
    if (authError) return authError;

    const body = await request.json();
    const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : '';

    if (!customerId || user.id !== customerId) return json({ error: 'Je mag alleen je eigen pushmeldingen beheren.' }, 403);

    await adminClient
      .from('customer_push_subscriptions')
      .update({ is_active: false, last_seen_at: new Date().toISOString() })
      .eq('customer_id', customerId);

    const { data: preferences, error: preferenceError } = await adminClient
      .from('customer_push_preferences')
      .upsert({
        customer_id: customerId,
        push_enabled: false,
        consent_source: 'customer-unsubscribe',
        consent_updated_at: new Date().toISOString(),
      }, { onConflict: 'customer_id' })
      .select('*')
      .single();

    if (preferenceError) return json({ error: preferenceError.message || 'Voorkeuren opslaan mislukt.' }, 400);

    return json({ preferences });
  } catch (error) {
    console.error('unsubscribe-push-subscription failed', error);
    return json({ error: error instanceof Error ? error.message : 'Onverwachte serverfout.' }, 500);
  }
});
