// @ts-nocheck

import { corsHeaders, getAdminClient, json } from '../_shared/push.ts';

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Alleen POST wordt ondersteund.' }, 405);

    const body = await request.json();
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : '';
    const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : null;
    const openedPath = typeof body.openedPath === 'string' ? body.openedPath.trim().slice(0, 200) : null;

    if (!campaignId) return json({ error: 'Campagne ontbreekt.' }, 400);

    const adminClient = getAdminClient();
    await adminClient.from('push_delivery_events').insert({
      campaign_id: campaignId,
      customer_id: customerId,
      status: 'clicked',
      opened_path: openedPath,
      clicked_at: new Date().toISOString(),
    });

    const { data: campaign } = await adminClient.from('push_campaigns').select('click_count').eq('id', campaignId).single();
    await adminClient.from('push_campaigns').update({ click_count: Number(campaign?.click_count ?? 0) + 1 }).eq('id', campaignId);

    return json({ ok: true });
  } catch (error) {
    console.error('track-push-click failed', error);
    return json({ error: error instanceof Error ? error.message : 'Onverwachte serverfout.' }, 500);
  }
});
