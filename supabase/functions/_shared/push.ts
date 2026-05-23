// @ts-nocheck

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function extractAccessToken(authHeader: string | null) {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase Edge Function is niet volledig geconfigureerd.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireUser(adminClient: ReturnType<typeof createClient>, accessToken: string | null) {
  if (!accessToken) {
    return { error: json({ error: 'Niet geautoriseerd.' }, 401), user: null, email: '' };
  }

  const { data, error } = await adminClient.auth.getUser(accessToken);
  const email = data.user?.email?.trim().toLowerCase() ?? '';

  if (error || !data.user) {
    console.error('User session validation failed', error);
    return { error: json({ error: 'Je sessie is ongeldig. Log opnieuw in.' }, 401), user: null, email: '' };
  }

  return { error: null, user: data.user, email };
}

export async function requireAdmin(adminClient: ReturnType<typeof createClient>, accessToken: string | null) {
  const userResult = await requireUser(adminClient, accessToken);

  if (userResult.error) {
    return { error: userResult.error, requesterEmail: '' };
  }

  const requesterEmail = userResult.email;
  const { data: adminRows, error: adminLookupError } = await adminClient
    .from('admin_users')
    .select('email, is_active');

  if (adminLookupError) {
    console.error('Admin lookup failed', adminLookupError);
    return { error: json({ error: 'Admincontrole mislukte. Probeer opnieuw.' }, 500), requesterEmail };
  }

  const adminRecord = (adminRows ?? []).find((record) => record.email?.trim().toLowerCase() === requesterEmail) ?? null;

  if (!adminRecord || adminRecord.is_active === false) {
    return { error: json({ error: `Dit adminaccount staat niet actief in admin_users: ${requesterEmail}` }, 403), requesterEmail };
  }

  return { error: null, requesterEmail };
}

export function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function normalizeCampaignType(value: unknown) {
  const allowed = ['manual_custom', 'reward_ready', 'reward_reminder', 'inactivity_reminder', 'promo_open_bottle'];
  return allowed.includes(value) ? value : 'manual_custom';
}

export function normalizeDeliveryCategory(value: unknown) {
  const allowed = ['service', 'reward', 'reminder', 'promo'];
  return allowed.includes(value) ? value : 'promo';
}

export function configureWebPush() {
  const publicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY') || Deno.env.get('VITE_WEB_PUSH_VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('WEB_PUSH_SUBJECT') || 'mailto:info@cozy-moments.be';

  if (!publicKey || !privateKey) {
    throw new Error('Web Push VAPID sleutels ontbreken.');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function mapCampaign(row: any) {
  return {
    id: row.id,
    campaign_type: row.campaign_type,
    delivery_category: row.delivery_category,
    template_key: row.template_key,
    title: row.title,
    body: row.body,
    deeplink: row.deeplink,
    audience_mode: row.audience_mode,
    audience_filters: row.audience_filters,
    estimated_recipients: row.estimated_recipients,
    actual_recipients: row.actual_recipients,
    sent_count: row.sent_count,
    failure_count: row.failure_count,
    click_count: row.click_count,
    status: row.status,
    created_by_admin_email: row.created_by_admin_email,
    scheduled_for: row.scheduled_for,
    sent_at: row.sent_at,
    created_at: row.created_at,
  };
}

function hasReward(customer: any) {
  return Number(customer.coffee_rewards ?? 0)
    + Number(customer.wine_rewards ?? 0)
    + Number(customer.beer_rewards ?? 0)
    + Number(customer.soda_rewards ?? 0) > 0;
}

function favoriteTypes(customer: any) {
  const entries = [
    ['coffee', Number(customer.coffee_stamps ?? 0) + (Number(customer.coffee_rewards ?? 0) * 12) + (Number(customer.coffee_claimed ?? 0) * 12)],
    ['wine', Number(customer.wine_stamps ?? 0) + (Number(customer.wine_rewards ?? 0) * 12) + (Number(customer.wine_claimed ?? 0) * 12)],
    ['beer', Number(customer.beer_stamps ?? 0) + (Number(customer.beer_rewards ?? 0) * 12) + (Number(customer.beer_claimed ?? 0) * 12)],
    ['soda', Number(customer.soda_stamps ?? 0) + (Number(customer.soda_rewards ?? 0) * 12) + (Number(customer.soda_claimed ?? 0) * 12)],
  ];
  const max = Math.max(...entries.map(([, score]) => Number(score)));
  if (max <= 0) return [];
  return entries.filter(([, score]) => Number(score) === max).map(([type]) => type);
}

function nextBirthdayDate(dayValue: unknown, monthValue: unknown, now = Date.now()) {
  const day = Number(dayValue ?? 0);
  const month = Number(monthValue ?? 0);
  if (!Number.isInteger(day) || !Number.isInteger(month) || day < 1 || month < 1 || month > 12) return null;

  const nowDate = new Date(now);
  const currentYear = nowDate.getFullYear();
  const today = new Date(currentYear, nowDate.getMonth(), nowDate.getDate());
  let birthday = new Date(currentYear, month - 1, day);

  if (birthday.getMonth() !== month - 1 || birthday.getDate() !== day) {
    birthday = new Date(currentYear, 1, 28);
  }

  if (birthday < today) {
    birthday = new Date(currentYear + 1, birthday.getMonth(), birthday.getDate());
  }

  return birthday;
}

export function matchesAudience(customer: any, preference: any, filters: any, category: string, now = Date.now()) {
  if (!preference?.push_enabled) return false;
  if (category === 'promo' && !preference.promo_opt_in) return false;
  if ((category === 'reward' || category === 'service') && preference.reward_opt_in === false) return false;
  if (category === 'reminder' && preference.reminder_opt_in === false) return false;
  if (preference.muted_until && Date.parse(preference.muted_until) > now) return false;

  if (filters?.customerId && filters.customerId !== customer.id) return false;
  if (Array.isArray(filters?.loyaltyTiers) && filters.loyaltyTiers.length > 0 && !filters.loyaltyTiers.includes(customer.loyalty_tier)) return false;
  if (filters?.requiresReward && !hasReward(customer)) return false;
  if (typeof filters?.minVisits === 'number' && Number(customer.total_visits ?? 0) < filters.minVisits) return false;

  if (typeof filters?.inactivityDays === 'number') {
    const lastVisit = Date.parse(customer.last_visit_at ?? '');
    if (!Number.isFinite(lastVisit) || now - lastVisit < filters.inactivityDays * 24 * 60 * 60 * 1000) return false;
  }

  if (typeof filters?.recentVisitDays === 'number') {
    const lastVisit = Date.parse(customer.last_visit_at ?? '');
    if (!Number.isFinite(lastVisit) || now - lastVisit > filters.recentVisitDays * 24 * 60 * 60 * 1000) return false;
  }

  if (typeof filters?.birthdayWindowDays === 'number') {
    const nowDate = new Date(now);
    const today = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
    const birthdayDates = [
      nextBirthdayDate(customer.birthday_day, customer.birthday_month, now),
      nextBirthdayDate(customer.partner_birthday_day, customer.partner_birthday_month, now),
    ].filter(Boolean);
    const hasBirthdayInWindow = birthdayDates.some((birthday) => {
      const daysUntil = Math.round((birthday.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      return daysUntil >= 0 && daysUntil <= filters.birthdayWindowDays;
    });
    if (!hasBirthdayInWindow) return false;
  }

  if (Array.isArray(filters?.favoriteDrinkTypes) && filters.favoriteDrinkTypes.length > 0) {
    const favorites = favoriteTypes(customer);
    if (!filters.favoriteDrinkTypes.some((type: string) => favorites.includes(type))) return false;
  }

  return true;
}

export async function resolveAudience(adminClient: ReturnType<typeof createClient>, filters: any, category: string) {
  const [{ data: customers, error: customerError }, { data: preferences, error: preferenceError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
    adminClient.from('customers').select('*'),
    adminClient.from('customer_push_preferences').select('*'),
    adminClient.from('customer_push_subscriptions').select('*').eq('is_active', true),
  ]);

  if (customerError) throw new Error(customerError.message || 'Klanten laden mislukt.');
  if (preferenceError) throw new Error(preferenceError.message || 'Pushvoorkeuren laden mislukt.');
  if (subscriptionError) throw new Error(subscriptionError.message || 'Pushabonnementen laden mislukt.');

  const preferenceMap = new Map((preferences ?? []).map((entry: any) => [entry.customer_id, entry]));
  const subscriptionMap = new Map<string, any[]>();
  for (const subscription of subscriptions ?? []) {
    const list = subscriptionMap.get(subscription.customer_id) ?? [];
    list.push(subscription);
    subscriptionMap.set(subscription.customer_id, list);
  }

  const recipients = [];
  for (const customer of customers ?? []) {
    const preference = preferenceMap.get(customer.id);
    if (!matchesAudience(customer, preference, filters, category)) continue;
    const customerSubscriptions = subscriptionMap.get(customer.id) ?? [];
    if (customerSubscriptions.length === 0) continue;
    recipients.push({ customer, preference, subscriptions: customerSubscriptions });
  }

  return recipients;
}

export async function sendCampaignToRecipients(adminClient: ReturnType<typeof createClient>, campaign: any, recipients: any[]) {
  configureWebPush();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const trackingUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/track-push-click` : '';

  let sentCount = 0;
  let failureCount = 0;

  for (const recipient of recipients) {
    for (const subscription of recipient.subscriptions) {
      const payload = JSON.stringify({
        campaignId: campaign.id,
        customerId: recipient.customer.id,
        title: campaign.title,
        body: campaign.body,
        icon: '/icon-192.png',
        badge: '/coffee-badge.png',
        deeplink: campaign.deeplink || '/dashboard',
        tag: `${campaign.campaign_type}-${recipient.customer.id}`,
        kind: campaign.campaign_type,
        deliveryCategory: campaign.delivery_category,
        trackingUrl,
      });

      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        }, payload, { TTL: 60 * 60 * 8 });

        sentCount += 1;
        await adminClient.from('push_delivery_events').insert({
          campaign_id: campaign.id,
          customer_id: recipient.customer.id,
          subscription_id: subscription.id,
          status: 'sent',
        });
      } catch (error) {
        failureCount += 1;
        const statusCode = Number(error?.statusCode ?? error?.status ?? 0);
        const message = error instanceof Error ? error.message : 'Push verzenden mislukt.';

        await adminClient.from('push_delivery_events').insert({
          campaign_id: campaign.id,
          customer_id: recipient.customer.id,
          subscription_id: subscription.id,
          status: 'failed',
          error_code: statusCode ? String(statusCode) : null,
          error_message: message,
        });

        if (statusCode === 404 || statusCode === 410) {
          await adminClient
            .from('customer_push_subscriptions')
            .update({ is_active: false, last_error_at: new Date().toISOString(), last_error_reason: message })
            .eq('id', subscription.id);
        }
      }
    }
  }

  const status = sentCount > 0 && failureCount > 0 ? 'partial' : sentCount > 0 ? 'sent' : 'failed';
  const { data, error } = await adminClient
    .from('push_campaigns')
    .update({
      actual_recipients: recipients.length,
      sent_count: sentCount,
      failure_count: failureCount,
      status,
      sent_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message || 'Campagnestatus bijwerken mislukt.');
  return data;
}
