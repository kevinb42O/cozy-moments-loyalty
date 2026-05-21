import { supabase, SUPABASE_ANON_KEY, SUPABASE_READY, SUPABASE_URL } from './supabase';
import {
  DEFAULT_PUSH_PREFERENCES,
  getInstalledMode,
  getPushPermissionState,
  isIosDevice,
  isPushSupportedBrowser,
  isStandaloneDisplayMode,
  normalizePushPreferences,
  normalizePushSubscription,
  urlBase64ToUint8Array,
  type CustomerPushPreferences,
  type CustomerPushSubscription,
  type PushInstalledMode,
} from './push-notifications';
import type { Customer } from '../store/LoyaltyContext';

export type PushPermissionStatus = NotificationPermission | 'unsupported';
export type PushUnavailableReason = 'none'
  | 'no-customer'
  | 'insecure-context'
  | 'unsupported-browser'
  | 'missing-public-key'
  | 'ios-not-installed'
  | 'permission-denied';

export interface CustomerPushState {
  supported: boolean;
  iosDevice: boolean;
  standalone: boolean;
  installedMode: PushInstalledMode;
  permission: PushPermissionStatus;
  subscription: CustomerPushSubscription | null;
  preferences: CustomerPushPreferences | null;
  publicKeyConfigured: boolean;
  canPrompt: boolean;
  unavailableReason: PushUnavailableReason;
  unavailableMessage: string | null;
}

export interface UpdatePushPreferencesInput {
  pushEnabled?: boolean;
  promoOptIn?: boolean;
  rewardOptIn?: boolean;
  reminderOptIn?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  mutedUntil?: string | null;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY as string | undefined;
const SERVICE_WORKER_READY_TIMEOUT_MS = 8000;

function isSecurePushContext() {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

function getPushUnavailableMessage(reason: PushUnavailableReason) {
  switch (reason) {
    case 'no-customer':
      return 'Log opnieuw in om meldingen te beheren.';
    case 'insecure-context':
      return 'Pushmeldingen werken alleen via een veilige https-verbinding.';
    case 'unsupported-browser':
      return 'Dit toestel ondersteunt web push niet. Op iPhone heb je iOS 16.4 of nieuwer nodig en moet de spaarkaart op je beginscherm staan.';
    case 'missing-public-key':
      return 'Pushmeldingen zijn nog niet volledig geconfigureerd.';
    case 'ios-not-installed':
      return 'Open deze app via het beginscherm van je iPhone. Meldingen werken op iPhone alleen in de geinstalleerde spaarkaart-app.';
    case 'permission-denied':
      return 'Meldingen zijn geblokkeerd op dit toestel. Zet ze aan via iPhone Instellingen > Meldingen > Cozy Spaarkaart.';
    case 'none':
      return null;
  }
}

function getPushUnavailableReason(customer: Customer | null, args: {
  supported: boolean;
  iosDevice: boolean;
  standalone: boolean;
  permission: PushPermissionStatus;
  publicKeyConfigured: boolean;
}): PushUnavailableReason {
  if (!customer) {
    return 'no-customer';
  }

  if (!isSecurePushContext()) {
    return 'insecure-context';
  }

  if (!args.supported) {
    return 'unsupported-browser';
  }

  if (!args.publicKeyConfigured) {
    return 'missing-public-key';
  }

  if (args.iosDevice && !args.standalone) {
    return 'ios-not-installed';
  }

  if (args.permission === 'denied') {
    return 'permission-denied';
  }

  return 'none';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function ensureCustomerServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers worden niet ondersteund door deze browser.');
  }

  let registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  try {
    await registration.update();
  } catch (error) {
    console.warn('Service worker update controleren mislukte:', error);
  }

  const readyRegistration = await withTimeout(
    navigator.serviceWorker.ready,
    SERVICE_WORKER_READY_TIMEOUT_MS,
    'De meldingenservice is nog niet klaar. Sluit de app volledig en open de spaarkaart opnieuw vanaf je beginscherm.',
  );

  if (!readyRegistration.pushManager) {
    throw new Error('Pushmeldingen worden niet ondersteund door deze browser.');
  }

  return readyRegistration;
}

function snakeToPreferences(row: any, customerId: string) {
  if (!row) {
    return null;
  }

  return normalizePushPreferences({
    customerId: row.customer_id ?? customerId,
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
  }, customerId);
}

function snakeToSubscription(row: any) {
  if (!row) {
    return null;
  }

  return normalizePushSubscription({
    id: row.id,
    customerId: row.customer_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    platform: row.platform,
    userAgent: row.user_agent,
    installedMode: row.installed_mode,
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at,
    lastErrorAt: row.last_error_at,
    lastErrorReason: row.last_error_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function subscriptionToPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
  };
}

async function callCustomerPushFunction<TResponse>(functionName: string, payload: unknown) {
  if (!SUPABASE_READY || !supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is niet geconfigureerd.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || 'Je sessie kon niet gecontroleerd worden.');
  }

  if (!session?.access_token) {
    throw new Error('Log opnieuw in om meldingen te beheren.');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || `Meldingen bijwerken mislukt (${response.status}).`);
  }

  return data as TResponse;
}

export function getInitialCustomerPushState(customer: Customer | null): CustomerPushState {
  const supported = isPushSupportedBrowser();
  const iosDevice = isIosDevice();
  const standalone = isStandaloneDisplayMode();
  const permission = getPushPermissionState();
  const publicKeyConfigured = Boolean(VAPID_PUBLIC_KEY);
  const unavailableReason = getPushUnavailableReason(customer, {
    supported,
    iosDevice,
    standalone,
    permission,
    publicKeyConfigured,
  });

  return {
    supported,
    iosDevice,
    standalone,
    installedMode: getInstalledMode(),
    permission,
    subscription: null,
    preferences: customer ? normalizePushPreferences(null, customer.id) : null,
    publicKeyConfigured,
    canPrompt: unavailableReason === 'none',
    unavailableReason,
    unavailableMessage: getPushUnavailableMessage(unavailableReason),
  };
}

export async function fetchCustomerPushState(customer: Customer): Promise<CustomerPushState> {
  const base = getInitialCustomerPushState(customer);

  if (!supabase) {
    return base;
  }

  const [preferenceResult, subscriptionResult] = await Promise.all([
    supabase
      .from('customer_push_preferences')
      .select('*')
      .eq('customer_id', customer.id)
      .maybeSingle(),
    supabase
      .from('customer_push_subscriptions')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (preferenceResult.error) {
    console.error('Kon push voorkeuren niet laden:', preferenceResult.error);
  }

  if (subscriptionResult.error) {
    console.error('Kon push abonnement niet laden:', subscriptionResult.error);
  }

  const preferences = snakeToPreferences(preferenceResult.data, customer.id) ?? normalizePushPreferences({
    ...DEFAULT_PUSH_PREFERENCES,
    customerId: customer.id,
  }, customer.id);

  return {
    ...base,
    preferences,
    subscription: snakeToSubscription(subscriptionResult.data),
  };
}

export async function updateCustomerPushPreferences(customerId: string, input: UpdatePushPreferencesInput) {
  if (!supabase) {
    throw new Error('Supabase is niet geconfigureerd.');
  }

  const payload = {
    customer_id: customerId,
    push_enabled: input.pushEnabled,
    promo_opt_in: input.promoOptIn,
    reward_opt_in: input.rewardOptIn,
    reminder_opt_in: input.reminderOptIn,
    quiet_hours_start: input.quietHoursStart,
    quiet_hours_end: input.quietHoursEnd,
    muted_until: input.mutedUntil,
    consent_source: 'customer-self-service',
    consent_updated_at: new Date().toISOString(),
  };

  const cleaned = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

  const { data, error } = await supabase
    .from('customer_push_preferences')
    .upsert(cleaned, { onConflict: 'customer_id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Meldingsvoorkeuren opslaan mislukt.');
  }

  return snakeToPreferences(data, customerId)!;
}

export async function subscribeCustomerToPush(customer: Customer) {
  if (!isSecurePushContext()) {
    throw new Error('Pushmeldingen werken alleen via een veilige https-verbinding.');
  }

  if (!isPushSupportedBrowser()) {
    throw new Error('Pushmeldingen worden niet ondersteund door deze browser. Op iPhone heb je iOS 16.4 of nieuwer nodig en moet de spaarkaart op je beginscherm staan.');
  }

  if (isIosDevice() && !isStandaloneDisplayMode()) {
    throw new Error('Open deze app via het beginscherm van je iPhone. Meldingen werken op iPhone alleen in de geinstalleerde spaarkaart-app.');
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Pushmeldingen zijn nog niet volledig geconfigureerd.');
  }

  if (Notification.permission === 'denied') {
    throw new Error('Meldingen zijn geblokkeerd op dit toestel. Zet ze aan via iPhone Instellingen > Meldingen > Cozy Spaarkaart.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Meldingen zijn niet toegestaan op dit toestel.');
  }

  const registration = await ensureCustomerServiceWorkerRegistration();
  let browserSubscription = await registration.pushManager.getSubscription();

  if (!browserSubscription) {
    try {
      browserSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (error: any) {
      throw new Error(error?.message || 'Het push abonnement kon niet worden aangemaakt. Sluit de app volledig en open de spaarkaart opnieuw vanaf je beginscherm.');
    }
  }

  const result = await callCustomerPushFunction<{ preferences?: any; subscription?: any }>('register-push-subscription', {
    customerId: customer.id,
    subscription: subscriptionToPayload(browserSubscription),
    platform: isIosDevice() ? 'ios-pwa' : 'web',
    userAgent: navigator.userAgent,
    installedMode: getInstalledMode(),
  });

  return {
    preferences: snakeToPreferences(result.preferences, customer.id),
    subscription: snakeToSubscription(result.subscription),
  };
}

export async function unsubscribeCustomerFromPush(customerId: string) {
  if (isPushSupportedBrowser()) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      await subscription?.unsubscribe();
    } catch (error) {
      console.warn('Browser push abonnement verwijderen mislukte:', error);
    }
  }

  const result = await callCustomerPushFunction<{ preferences?: any }>('unsubscribe-push-subscription', { customerId });
  return snakeToPreferences(result.preferences, customerId);
}
