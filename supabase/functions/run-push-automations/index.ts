// @ts-nocheck

import {
  corsHeaders,
  extractAccessToken,
  getAdminClient,
  json,
  mapCampaign,
  requireAdmin,
  resolveAudience,
  sendCampaignToRecipients,
} from '../_shared/push.ts';

async function createAndSend(adminClient, draft) {
  const recipients = await resolveAudience(adminClient, draft.filters, draft.category);
  if (recipients.length === 0) return null;

  const { data: campaign, error } = await adminClient
    .from('push_campaigns')
    .insert({
      campaign_type: draft.type,
      delivery_category: draft.category,
      template_key: draft.templateKey,
      title: draft.title,
      body: draft.body,
      deeplink: draft.deeplink,
      audience_mode: 'segment',
      audience_filters: draft.filters,
      estimated_recipients: recipients.length,
      status: 'draft',
      created_by_admin_email: 'automation',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message || 'Automatiecampagne aanmaken mislukt.');
  const updated = await sendCampaignToRecipients(adminClient, campaign, recipients);
  return mapCampaign(updated);
}

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Alleen POST wordt ondersteund.' }, 405);

    const adminClient = getAdminClient();
    const cronSecret = Deno.env.get('PUSH_AUTOMATION_SECRET');
    const providedSecret = request.headers.get('x-push-automation-secret');

    if (!cronSecret || providedSecret !== cronSecret) {
      const { error: adminError } = await requireAdmin(adminClient, extractAccessToken(request.headers.get('Authorization')));
      if (adminError) return adminError;
    }

    const { data: settings } = await adminClient.from('site_settings').select('push_settings').eq('id', 'default').single();
    if (settings?.push_settings?.disableAllPush) return json({ createdCampaigns: [], skipped: ['Pushmeldingen staan globaal gepauzeerd.'] });

    const automations = settings?.push_settings?.automations ?? {};
    const createdCampaigns = [];
    const skipped = [];

    if (automations.rewardReady !== false) {
      const campaign = await createAndSend(adminClient, {
        type: 'reward_ready',
        category: 'reward',
        templateKey: 'reward-ready-v1',
        title: 'Je beloning staat klaar',
        body: 'Je hebt een gratis consumptie klaarstaan bij Cozy Moments.',
        deeplink: '/rewards',
        filters: { requiresReward: true },
      });
      campaign ? createdCampaigns.push(campaign) : skipped.push('Geen reward-ready ontvangers.');
    }

    if (automations.inactivityReminder !== false) {
      const campaign = await createAndSend(adminClient, {
        type: 'inactivity_reminder',
        category: 'reminder',
        templateKey: 'inactivity-30-v1',
        title: 'Zin in een Cozy moment?',
        body: 'Je spaarkaart wacht nog op je volgende bezoek.',
        deeplink: '/dashboard',
        filters: { inactivityDays: 30, minVisits: 3 },
      });
      campaign ? createdCampaigns.push(campaign) : skipped.push('Geen inactivity ontvangers.');
    }

    return json({ createdCampaigns, skipped });
  } catch (error) {
    console.error('run-push-automations failed', error);
    return json({ error: error instanceof Error ? error.message : 'Onverwachte serverfout.' }, 500);
  }
});
