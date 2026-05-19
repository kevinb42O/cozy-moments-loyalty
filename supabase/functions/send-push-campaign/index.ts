// @ts-nocheck

import {
  corsHeaders,
  extractAccessToken,
  getAdminClient,
  json,
  mapCampaign,
  normalizeCampaignType,
  normalizeDeliveryCategory,
  normalizeText,
  requireAdmin,
  resolveAudience,
  sendCampaignToRecipients,
} from '../_shared/push.ts';

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Alleen POST wordt ondersteund.' }, 405);

    const adminClient = getAdminClient();
    const { error: adminError, requesterEmail } = await requireAdmin(adminClient, extractAccessToken(request.headers.get('Authorization')));
    if (adminError) return adminError;

    const body = await request.json();
    const title = normalizeText(body.title, 72);
    const campaignBody = normalizeText(body.body, 180);
    const campaignType = normalizeCampaignType(body.campaignType);
    const deliveryCategory = normalizeDeliveryCategory(body.deliveryCategory);
    const deeplink = normalizeText(body.deeplink, 120) || '/dashboard';
    const audienceFilters = typeof body.audienceFilters === 'object' && body.audienceFilters ? body.audienceFilters : {};
    const audienceMode = ['all', 'segment', 'single'].includes(body.audienceMode) ? body.audienceMode : 'segment';

    if (title.length < 3) return json({ error: 'Geef een duidelijke titel in.' }, 400);
    if (campaignBody.length < 8) return json({ error: 'Geef een duidelijk bericht in.' }, 400);

    const { data: settings } = await adminClient.from('site_settings').select('push_settings').eq('id', 'default').single();
    if (settings?.push_settings?.disableAllPush) return json({ error: 'Pushmeldingen staan globaal gepauzeerd.' }, 409);
    if (deliveryCategory === 'promo' && settings?.push_settings?.promotionsPaused) return json({ error: 'Promotionele pushmeldingen staan gepauzeerd.' }, 409);

    const recipients = await resolveAudience(adminClient, audienceFilters, deliveryCategory);

    const { data: campaign, error: campaignError } = await adminClient
      .from('push_campaigns')
      .insert({
        campaign_type: campaignType,
        delivery_category: deliveryCategory,
        title,
        body: campaignBody,
        deeplink,
        audience_mode: audienceMode,
        audience_filters: audienceFilters,
        estimated_recipients: Number(body.estimatedRecipients ?? recipients.length),
        actual_recipients: 0,
        status: 'draft',
        created_by_admin_email: requesterEmail,
      })
      .select('*')
      .single();

    if (campaignError) return json({ error: campaignError.message || 'Campagne aanmaken mislukt.' }, 400);

    const updatedCampaign = await sendCampaignToRecipients(adminClient, campaign, recipients);
    return json({ campaign: mapCampaign(updatedCampaign) }, updatedCampaign.status === 'failed' ? 207 : 200);
  } catch (error) {
    console.error('send-push-campaign failed', error);
    return json({ error: error instanceof Error ? error.message : 'Onverwachte serverfout.' }, 500);
  }
});
