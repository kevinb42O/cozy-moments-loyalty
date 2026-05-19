import { callAdminEdgeFunction } from './admin-edge';
import { supabase } from '../../shared/lib/supabase';
import {
  DEFAULT_PUSH_SETTINGS,
  estimatePushAudience,
  normalizePushCampaign,
  normalizePushPreferences,
  normalizePushSettings,
  type PushAudienceFilters,
  type PushCampaignRecord,
  type PushCampaignType,
  type PushDeliveryCategory,
  type PushSettingsConfig,
} from '../../shared/lib/push-notifications';
import type { Customer } from '../../shared/store/LoyaltyContext';

export interface PushCampaignDraft {
  campaignType: PushCampaignType;
  deliveryCategory: PushDeliveryCategory;
  title: string;
  body: string;
  deeplink: string;
  audienceFilters: PushAudienceFilters;
  audienceMode: 'all' | 'segment' | 'single';
  estimatedRecipients: number;
}

export interface PushMetrics {
  activeSubscriptions: number;
  pushEnabledCustomers: number;
  promoOptInCustomers: number;
  campaignsLast30Days: number;
  clicksLast30Days: number;
  failedDeliveriesLast30Days: number;
}

function snakeToCampaign(row: any): PushCampaignRecord {
  return normalizePushCampaign({
    id: row.id,
    campaignType: row.campaign_type,
    deliveryCategory: row.delivery_category,
    templateKey: row.template_key,
    title: row.title,
    body: row.body,
    deeplink: row.deeplink,
    audienceMode: row.audience_mode,
    audienceFilters: row.audience_filters,
    estimatedRecipients: row.estimated_recipients,
    actualRecipients: row.actual_recipients,
    sentCount: row.sent_count,
    failureCount: row.failure_count,
    clickCount: row.click_count,
    status: row.status,
    createdByAdminEmail: row.created_by_admin_email,
    scheduledFor: row.scheduled_for,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  });
}

function snakeToPreferences(row: any) {
  return normalizePushPreferences({
    customerId: row.customer_id,
    pushEnabled: row.push_enabled,
    promoOptIn: row.promo_opt_in,
    rewardOptIn: row.reward_opt_in,
    reminderOptIn: row.reminder_opt_in,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    mutedUntil: row.muted_until,
    consentSource: row.consent_source,
    consentUpdatedAt: row.consent_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }, row.customer_id);
}

export async function listPushCampaigns() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('push_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message || 'Pushhistoriek laden mislukt.');
  }

  return (data ?? []).map(snakeToCampaign);
}

export async function listPushPreferences() {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('customer_push_preferences')
    .select('*');

  if (error) {
    throw new Error(error.message || 'Pushvoorkeuren laden mislukt.');
  }

  return (data ?? []).map(snakeToPreferences);
}

export async function estimatePushRecipients(customers: Customer[], filters: PushAudienceFilters) {
  const preferences = await listPushPreferences();
  return estimatePushAudience(customers, preferences, filters);
}

export async function loadPushSettings() {
  if (!supabase) {
    return DEFAULT_PUSH_SETTINGS;
  }

  const { data, error } = await supabase
    .from('site_settings')
    .select('push_settings')
    .eq('id', 'default')
    .single();

  if (error) {
    throw new Error(error.message || 'Pushinstellingen laden mislukt.');
  }

  return normalizePushSettings(data?.push_settings);
}

export async function savePushSettings(settings: PushSettingsConfig) {
  if (!supabase) {
    throw new Error('Supabase is niet geconfigureerd.');
  }

  const { data, error } = await supabase
    .from('site_settings')
    .update({ push_settings: settings })
    .eq('id', 'default')
    .select('push_settings')
    .single();

  if (error) {
    throw new Error(error.message || 'Pushinstellingen opslaan mislukt.');
  }

  return normalizePushSettings(data?.push_settings);
}

export async function loadPushMetrics(): Promise<PushMetrics> {
  if (!supabase) {
    return {
      activeSubscriptions: 0,
      pushEnabledCustomers: 0,
      promoOptInCustomers: 0,
      campaignsLast30Days: 0,
      clicksLast30Days: 0,
      failedDeliveriesLast30Days: 0,
    };
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [subscriptions, preferences, campaigns, clicks, failures] = await Promise.all([
    supabase.from('customer_push_subscriptions').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('customer_push_preferences').select('push_enabled, promo_opt_in'),
    supabase.from('push_campaigns').select('id', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('push_delivery_events').select('id', { count: 'exact', head: true }).eq('status', 'clicked').gte('created_at', since),
    supabase.from('push_delivery_events').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since),
  ]);

  const preferenceRows = preferences.data ?? [];

  return {
    activeSubscriptions: subscriptions.count ?? 0,
    pushEnabledCustomers: preferenceRows.filter((row) => row.push_enabled).length,
    promoOptInCustomers: preferenceRows.filter((row) => row.promo_opt_in).length,
    campaignsLast30Days: campaigns.count ?? 0,
    clicksLast30Days: clicks.count ?? 0,
    failedDeliveriesLast30Days: failures.count ?? 0,
  };
}

export async function sendPushCampaign(draft: PushCampaignDraft) {
  const result = await callAdminEdgeFunction<{ campaign?: any }>('send-push-campaign', draft);

  if (!result?.campaign) {
    throw new Error('De server stuurde geen geldige campagne terug.');
  }

  return snakeToCampaign(result.campaign);
}

export async function runPushAutomations() {
  return callAdminEdgeFunction<{ createdCampaigns?: PushCampaignRecord[]; skipped?: string[] }>('run-push-automations', {});
}
