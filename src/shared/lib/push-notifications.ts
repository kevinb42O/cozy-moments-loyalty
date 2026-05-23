import type { CardType, Customer } from '../store/LoyaltyContext';
import type { LoyaltyTier } from './loyalty-tier';
import { hasCustomerBirthdayWithinWindow } from './customer-birthday';

export const PUSH_CAMPAIGN_TYPES = [
  'manual_custom',
  'reward_ready',
  'reward_reminder',
  'inactivity_reminder',
  'promo_open_bottle',
] as const;

export const PUSH_DELIVERY_CATEGORIES = ['service', 'reward', 'reminder', 'promo'] as const;
export const PUSH_AUDIENCE_MODES = ['all', 'segment', 'single'] as const;
export const PUSH_DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'clicked'] as const;

export type PushCampaignType = typeof PUSH_CAMPAIGN_TYPES[number];
export type PushDeliveryCategory = typeof PUSH_DELIVERY_CATEGORIES[number];
export type PushAudienceMode = typeof PUSH_AUDIENCE_MODES[number];
export type PushDeliveryStatus = typeof PUSH_DELIVERY_STATUSES[number];
export type PushInstalledMode = 'browser' | 'standalone' | 'twa' | 'unknown';

export interface CustomerPushPreferences {
  customerId: string;
  pushEnabled: boolean;
  promoOptIn: boolean;
  rewardOptIn: boolean;
  reminderOptIn: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  mutedUntil: string | null;
  consentSource: string | null;
  consentUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPushSubscription {
  id: string;
  customerId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string | null;
  userAgent: string | null;
  installedMode: PushInstalledMode;
  isActive: boolean;
  lastSeenAt: string | null;
  lastErrorAt: string | null;
  lastErrorReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PushAudienceFilters {
  customerId?: string | null;
  loyaltyTiers?: LoyaltyTier[];
  requiresReward?: boolean;
  minVisits?: number;
  inactivityDays?: number;
  recentVisitDays?: number;
  birthdayWindowDays?: number;
  promoOptInOnly?: boolean;
  favoriteDrinkTypes?: CardType[];
}

export interface PushCampaignRecord {
  id: string;
  campaignType: PushCampaignType;
  deliveryCategory: PushDeliveryCategory;
  templateKey: string | null;
  title: string;
  body: string;
  deeplink: string;
  audienceMode: PushAudienceMode;
  audienceFilters: PushAudienceFilters;
  estimatedRecipients: number;
  actualRecipients: number;
  sentCount: number;
  failureCount: number;
  clickCount: number;
  status: 'draft' | 'sent' | 'partial' | 'failed';
  createdByAdminEmail: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface PushSettingsConfig {
  disableAllPush: boolean;
  promotionsPaused: boolean;
  automations: {
    rewardReady: boolean;
    rewardReminder: boolean;
    inactivityReminder: boolean;
  };
}

export const DEFAULT_PUSH_SETTINGS: PushSettingsConfig = {
  disableAllPush: false,
  promotionsPaused: false,
  automations: {
    rewardReady: true,
    rewardReminder: true,
    inactivityReminder: true,
  },
};

export const DEFAULT_PUSH_PREFERENCES: Omit<CustomerPushPreferences, 'customerId'> = {
  pushEnabled: false,
  promoOptIn: false,
  rewardOptIn: true,
  reminderOptIn: true,
  quietHoursStart: '20:00:00',
  quietHoursEnd: '10:00:00',
  mutedUntil: null,
  consentSource: 'customer-self-service',
  consentUpdatedAt: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

function coerceBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function coerceString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asIsoString(value: unknown, fallback = new Date(0).toISOString()) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function normalizePushPreferences(
  row: Partial<CustomerPushPreferences> | null | undefined,
  customerId = '',
): CustomerPushPreferences {
  return {
    customerId: typeof row?.customerId === 'string' && row.customerId.trim() ? row.customerId : customerId,
    pushEnabled: coerceBoolean(row?.pushEnabled, DEFAULT_PUSH_PREFERENCES.pushEnabled),
    promoOptIn: coerceBoolean(row?.promoOptIn, DEFAULT_PUSH_PREFERENCES.promoOptIn),
    rewardOptIn: coerceBoolean(row?.rewardOptIn, DEFAULT_PUSH_PREFERENCES.rewardOptIn),
    reminderOptIn: coerceBoolean(row?.reminderOptIn, DEFAULT_PUSH_PREFERENCES.reminderOptIn),
    quietHoursStart: coerceString(row?.quietHoursStart) ?? DEFAULT_PUSH_PREFERENCES.quietHoursStart,
    quietHoursEnd: coerceString(row?.quietHoursEnd) ?? DEFAULT_PUSH_PREFERENCES.quietHoursEnd,
    mutedUntil: coerceString(row?.mutedUntil),
    consentSource: coerceString(row?.consentSource) ?? DEFAULT_PUSH_PREFERENCES.consentSource,
    consentUpdatedAt: coerceString(row?.consentUpdatedAt),
    createdAt: asIsoString(row?.createdAt),
    updatedAt: asIsoString(row?.updatedAt),
  };
}

export function normalizePushSubscription(
  row: Partial<CustomerPushSubscription> | null | undefined,
): CustomerPushSubscription {
  return {
    id: typeof row?.id === 'string' ? row.id : '',
    customerId: typeof row?.customerId === 'string' ? row.customerId : '',
    endpoint: typeof row?.endpoint === 'string' ? row.endpoint : '',
    p256dh: typeof row?.p256dh === 'string' ? row.p256dh : '',
    auth: typeof row?.auth === 'string' ? row.auth : '',
    platform: coerceString(row?.platform),
    userAgent: coerceString(row?.userAgent),
    installedMode: row?.installedMode === 'standalone' || row?.installedMode === 'browser' || row?.installedMode === 'twa'
      ? row.installedMode
      : 'unknown',
    isActive: coerceBoolean(row?.isActive, true),
    lastSeenAt: coerceString(row?.lastSeenAt),
    lastErrorAt: coerceString(row?.lastErrorAt),
    lastErrorReason: coerceString(row?.lastErrorReason),
    createdAt: asIsoString(row?.createdAt),
    updatedAt: asIsoString(row?.updatedAt),
  };
}

export function normalizePushCampaign(row: Partial<PushCampaignRecord> | null | undefined): PushCampaignRecord {
  return {
    id: typeof row?.id === 'string' ? row.id : '',
    campaignType: PUSH_CAMPAIGN_TYPES.includes(row?.campaignType as PushCampaignType) ? row!.campaignType as PushCampaignType : 'manual_custom',
    deliveryCategory: PUSH_DELIVERY_CATEGORIES.includes(row?.deliveryCategory as PushDeliveryCategory)
      ? row!.deliveryCategory as PushDeliveryCategory
      : 'promo',
    templateKey: coerceString(row?.templateKey),
    title: typeof row?.title === 'string' ? row.title : '',
    body: typeof row?.body === 'string' ? row.body : '',
    deeplink: typeof row?.deeplink === 'string' && row.deeplink.trim() ? row.deeplink : '/dashboard',
    audienceMode: PUSH_AUDIENCE_MODES.includes(row?.audienceMode as PushAudienceMode) ? row!.audienceMode as PushAudienceMode : 'all',
    audienceFilters: typeof row?.audienceFilters === 'object' && row.audienceFilters ? row.audienceFilters as PushAudienceFilters : {},
    estimatedRecipients: Number.isFinite(Number(row?.estimatedRecipients)) ? Number(row?.estimatedRecipients) : 0,
    actualRecipients: Number.isFinite(Number(row?.actualRecipients)) ? Number(row?.actualRecipients) : 0,
    sentCount: Number.isFinite(Number(row?.sentCount)) ? Number(row?.sentCount) : 0,
    failureCount: Number.isFinite(Number(row?.failureCount)) ? Number(row?.failureCount) : 0,
    clickCount: Number.isFinite(Number(row?.clickCount)) ? Number(row?.clickCount) : 0,
    status: row?.status === 'draft' || row?.status === 'sent' || row?.status === 'partial' || row?.status === 'failed' ? row.status : 'draft',
    createdByAdminEmail: coerceString(row?.createdByAdminEmail),
    scheduledFor: coerceString(row?.scheduledFor),
    sentAt: coerceString(row?.sentAt),
    createdAt: asIsoString(row?.createdAt),
  };
}

export function normalizePushSettings(value: unknown): PushSettingsConfig {
  const source = typeof value === 'object' && value ? value as Partial<PushSettingsConfig> : {};
  const automations = typeof source.automations === 'object' && source.automations ? source.automations : {};

  return {
    disableAllPush: coerceBoolean(source.disableAllPush, DEFAULT_PUSH_SETTINGS.disableAllPush),
    promotionsPaused: coerceBoolean(source.promotionsPaused, DEFAULT_PUSH_SETTINGS.promotionsPaused),
    automations: {
      rewardReady: coerceBoolean((automations as Partial<PushSettingsConfig['automations']>).rewardReady, DEFAULT_PUSH_SETTINGS.automations.rewardReady),
      rewardReminder: coerceBoolean((automations as Partial<PushSettingsConfig['automations']>).rewardReminder, DEFAULT_PUSH_SETTINGS.automations.rewardReminder),
      inactivityReminder: coerceBoolean((automations as Partial<PushSettingsConfig['automations']>).inactivityReminder, DEFAULT_PUSH_SETTINGS.automations.inactivityReminder),
    },
  };
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

export function isPushSupportedBrowser() {
  return typeof window !== 'undefined'
    && window.isSecureContext === true
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || navigator.vendor || '';
  const platform = navigator.platform || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  return /iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)')?.matches === true || navigatorWithStandalone.standalone === true;
}

export function getInstalledMode(): PushInstalledMode {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  if (window.matchMedia?.('(display-mode: standalone)')?.matches) {
    return 'standalone';
  }

  if (window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches) {
    return 'twa';
  }

  return 'browser';
}

export function getPushPermissionState() {
  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }

  return Notification.permission;
}

export function canPromptForPush(customer: Customer | null) {
  if (!customer) {
    return false;
  }

  return customer.totalVisits > 0
    || customer.rewards.coffee + customer.rewards.wine + customer.rewards.beer + customer.rewards.soda > 0
    || customer.cards.coffee + customer.cards.wine + customer.cards.beer + customer.cards.soda > 0;
}

export function deriveFavoriteDrinkTypes(customer: Customer): CardType[] {
  const weighted: Array<{ type: CardType; score: number }> = [
    { type: 'coffee', score: customer.cards.coffee + (customer.rewards.coffee * 12) + (customer.claimedRewards.coffee * 12) },
    { type: 'wine', score: customer.cards.wine + (customer.rewards.wine * 12) + (customer.claimedRewards.wine * 12) },
    { type: 'beer', score: customer.cards.beer + (customer.rewards.beer * 12) + (customer.claimedRewards.beer * 12) },
    { type: 'soda', score: customer.cards.soda + (customer.rewards.soda * 12) + (customer.claimedRewards.soda * 12) },
  ];

  const maxScore = Math.max(...weighted.map((entry) => entry.score));
  if (maxScore <= 0) {
    return [];
  }

  return weighted.filter((entry) => entry.score === maxScore).map((entry) => entry.type);
}

export function matchesPushAudience(
  customer: Customer,
  preference: CustomerPushPreferences,
  filters: PushAudienceFilters,
  now = Date.now(),
) {
  if (filters.customerId && filters.customerId !== customer.id) {
    return false;
  }

  if (filters.loyaltyTiers?.length && !filters.loyaltyTiers.includes(customer.loyaltyTier)) {
    return false;
  }

  if (filters.requiresReward) {
    const rewardCount = customer.rewards.coffee + customer.rewards.wine + customer.rewards.beer + customer.rewards.soda;
    if (rewardCount <= 0) {
      return false;
    }
  }

  if (typeof filters.minVisits === 'number' && customer.totalVisits < filters.minVisits) {
    return false;
  }

  if (typeof filters.inactivityDays === 'number') {
    if (!customer.lastVisitAt) {
      return false;
    }

    const lastVisitTimestamp = Date.parse(customer.lastVisitAt);
    const inactivityThresholdMs = filters.inactivityDays * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(lastVisitTimestamp) || now - lastVisitTimestamp < inactivityThresholdMs) {
      return false;
    }
  }

  if (typeof filters.recentVisitDays === 'number') {
    if (!customer.lastVisitAt) {
      return false;
    }

    const lastVisitTimestamp = Date.parse(customer.lastVisitAt);
    const recentThresholdMs = filters.recentVisitDays * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(lastVisitTimestamp) || now - lastVisitTimestamp > recentThresholdMs) {
      return false;
    }
  }

  if (typeof filters.birthdayWindowDays === 'number') {
    if (!hasCustomerBirthdayWithinWindow(customer, new Date(now), filters.birthdayWindowDays)) {
      return false;
    }
  }

  if (filters.promoOptInOnly && !preference.promoOptIn) {
    return false;
  }

  if (filters.favoriteDrinkTypes?.length) {
    const favoriteTypes = deriveFavoriteDrinkTypes(customer);
    if (!filters.favoriteDrinkTypes.some((type) => favoriteTypes.includes(type))) {
      return false;
    }
  }

  return true;
}

export function estimatePushAudience(
  customers: Customer[],
  preferences: CustomerPushPreferences[],
  filters: PushAudienceFilters,
) {
  const preferenceMap = new Map(preferences.map((entry) => [entry.customerId, entry]));

  return customers.filter((customer) => {
    const preference = normalizePushPreferences(preferenceMap.get(customer.id), customer.id);
    return preference.pushEnabled && matchesPushAudience(customer, preference, filters);
  });
}

export function estimatePushAudienceWithActiveSubscriptions(
  customers: Customer[],
  preferences: CustomerPushPreferences[],
  activeSubscriptionCustomerIds: Iterable<string>,
  filters: PushAudienceFilters,
) {
  const activeCustomerIds = new Set(activeSubscriptionCustomerIds);
  return estimatePushAudience(customers, preferences, filters)
    .filter((customer) => activeCustomerIds.has(customer.id));
}

export function buildPushAudienceWarnings(args: {
  estimatedRecipients: number;
  deliveryCategory: PushDeliveryCategory;
  filters: PushAudienceFilters;
}) {
  const warnings: string[] = [];

  if (args.estimatedRecipients === 0) {
    warnings.push('Deze selectie levert momenteel geen ontvangers op.');
  }

  if (args.estimatedRecipients > 50 && args.deliveryCategory === 'promo') {
    warnings.push('Brede promotionele verzending: check extra goed of de selectie echt relevant is.');
  }

  if (args.deliveryCategory === 'promo' && !args.filters.promoOptInOnly) {
    warnings.push('Promoties horen alleen naar klanten met expliciete promo-opt-in te gaan.');
  }

  if (!args.filters.customerId && !args.filters.loyaltyTiers?.length && !args.filters.requiresReward && typeof args.filters.inactivityDays !== 'number' && typeof args.filters.birthdayWindowDays !== 'number') {
    warnings.push('Deze doelgroep is erg breed. Overweeg minstens een loyalty-, reward- of activiteitfilter.');
  }

  return warnings;
}
