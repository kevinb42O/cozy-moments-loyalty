import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellRing, CheckCircle, Clock3, Gift, History, Megaphone, PauseCircle, PlayCircle, RefreshCw, Search, Send, ShieldAlert, SlidersHorizontal, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLoyalty, cardTypeLabels, type CardType } from '../../shared/store/LoyaltyContext';
import { LOYALTY_TIER_CONFIG, LOYALTY_TIER_ORDER, type LoyaltyTier } from '../../shared/lib/loyalty-tier';
import {
  buildPushAudienceWarnings,
  type PushAudienceFilters,
  type PushCampaignType,
  type PushDeliveryCategory,
  type PushSettingsConfig,
} from '../../shared/lib/push-notifications';
import {
  estimatePushRecipients,
  listPushCampaigns,
  loadPushMetrics,
  loadPushSettings,
  runPushAutomations,
  savePushSettings,
  sendPushCampaign,
  type PushCampaignDraft,
  type PushMetrics,
} from '../lib/push-notifications';

interface PushNotificationsPageProps {
  adminEmail: string | null;
  isDarkMode: boolean;
}

type WorkspaceMode = 'compose' | 'history' | 'settings';
type AudiencePreset = 'all' | 'reward' | 'inactive' | 'tier' | 'favorite' | 'single';

type DraftState = {
  campaignType: PushCampaignType;
  deliveryCategory: PushDeliveryCategory;
  title: string;
  body: string;
  deeplink: string;
  audiencePreset: AudiencePreset;
  customerId: string;
  loyaltyTier: LoyaltyTier;
  favoriteDrinkType: CardType;
  inactivityDays: number;
  minVisits: number;
};

const DEFAULT_DRAFT: DraftState = {
  campaignType: 'manual_custom',
  deliveryCategory: 'promo',
  title: 'Cozy Moments update',
  body: 'Er staat iets leuks klaar in je Cozy spaarkaart.',
  deeplink: '/dashboard',
  audiencePreset: 'reward',
  customerId: '',
  loyaltyTier: 'gold',
  favoriteDrinkType: 'wine',
  inactivityDays: 30,
  minVisits: 3,
};

function cn(...inputs: Array<string | undefined | null | false>) {
  return twMerge(clsx(inputs));
}

function formatDateTime(value: string | null) {
  if (!value) return 'Nog niet verzonden';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Onbekend';
  return date.toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function buildFilters(draft: DraftState): PushAudienceFilters {
  if (draft.audiencePreset === 'reward') {
    return { requiresReward: true };
  }

  if (draft.audiencePreset === 'inactive') {
    return { inactivityDays: draft.inactivityDays, minVisits: draft.minVisits };
  }

  if (draft.audiencePreset === 'tier') {
    return { loyaltyTiers: [draft.loyaltyTier] };
  }

  if (draft.audiencePreset === 'favorite') {
    return { favoriteDrinkTypes: [draft.favoriteDrinkType], promoOptInOnly: draft.deliveryCategory === 'promo' };
  }

  if (draft.audiencePreset === 'single') {
    return { customerId: draft.customerId || null };
  }

  return draft.deliveryCategory === 'promo' ? { promoOptInOnly: true } : {};
}

function buildAudienceLabel(draft: DraftState) {
  if (draft.audiencePreset === 'reward') return 'Klanten met een beloning klaar';
  if (draft.audiencePreset === 'inactive') return `${draft.minVisits}+ bezoeken, ${draft.inactivityDays}+ dagen niet geweest`;
  if (draft.audiencePreset === 'tier') return `${LOYALTY_TIER_CONFIG[draft.loyaltyTier].label} klanten`;
  if (draft.audiencePreset === 'favorite') return `${cardTypeLabels[draft.favoriteDrinkType]} liefhebbers`;
  if (draft.audiencePreset === 'single') return 'Een specifieke klant';
  return 'Alle opted-in klanten';
}

export function PushNotificationsPage({ adminEmail, isDarkMode }: PushNotificationsPageProps) {
  const { customers } = useLoyalty();
  const [mode, setMode] = useState<WorkspaceMode>('compose');
  const [draft, setDraft] = useState<DraftState>(DEFAULT_DRAFT);
  const [recipientCount, setRecipientCount] = useState(0);
  const [matchingCustomerNames, setMatchingCustomerNames] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<Awaited<ReturnType<typeof listPushCampaigns>>>([]);
  const [metrics, setMetrics] = useState<PushMetrics | null>(null);
  const [settings, setSettings] = useState<PushSettingsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmBroadSend, setConfirmBroadSend] = useState(false);
  const [search, setSearch] = useState('');

  const filters = useMemo(() => buildFilters(draft), [draft]);
  const warnings = useMemo(() => buildPushAudienceWarnings({
    estimatedRecipients: recipientCount,
    deliveryCategory: draft.deliveryCategory,
    filters,
  }), [draft.deliveryCategory, filters, recipientCount]);

  const customerOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return customers
      .filter((customer) => !normalizedSearch
        || customer.name.toLowerCase().includes(normalizedSearch)
        || customer.email.toLowerCase().includes(normalizedSearch)
        || customer.loginEmail.toLowerCase().includes(normalizedSearch))
      .slice(0, 20);
  }, [customers, search]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextCampaigns, nextMetrics, nextSettings] = await Promise.all([
        listPushCampaigns(),
        loadPushMetrics(),
        loadPushSettings(),
      ]);
      setCampaigns(nextCampaigns);
      setMetrics(nextMetrics);
      setSettings(nextSettings);
    } catch (loadError: any) {
      setError(loadError?.message || 'Push workspace laden mislukt.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    let cancelled = false;
    setEstimating(true);

    void estimatePushRecipients(customers, filters).then((recipients) => {
      if (cancelled) return;
      setRecipientCount(recipients.length);
      setMatchingCustomerNames(recipients.slice(0, 4).map((customer) => customer.name));
    }).catch((estimateError) => {
      if (!cancelled) {
        console.error('Push audience estimate failed:', estimateError);
        setRecipientCount(0);
        setMatchingCustomerNames([]);
      }
    }).finally(() => {
      if (!cancelled) setEstimating(false);
    });

    return () => {
      cancelled = true;
    };
  }, [customers, filters]);

  const updateDraft = <TField extends keyof DraftState>(field: TField, value: DraftState[TField]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
    setNotice(null);
    setConfirmBroadSend(false);
  };

  const sendCampaignFromDraft = async () => {
    const title = draft.title.trim();
    const body = draft.body.trim();

    if (title.length < 3) {
      setError('Geef een duidelijke titel in.');
      return;
    }

    if (body.length < 8) {
      setError('Geef een duidelijk bericht in.');
      return;
    }

    if (recipientCount > 25 && !confirmBroadSend) {
      setConfirmBroadSend(true);
      return;
    }

    setSending(true);
    setError(null);
    setNotice(null);

    try {
      const payload: PushCampaignDraft = {
        campaignType: draft.campaignType,
        deliveryCategory: draft.deliveryCategory,
        title,
        body,
        deeplink: draft.deeplink || '/dashboard',
        audienceFilters: filters,
        audienceMode: draft.audiencePreset === 'single' ? 'single' : draft.audiencePreset === 'all' ? 'all' : 'segment',
        estimatedRecipients: recipientCount,
      };
      const campaign = await sendPushCampaign(payload);
      setNotice(`Campagne verzonden: ${campaign.sentCount} afgeleverd, ${campaign.failureCount} mislukt.`);
      setConfirmBroadSend(false);
      await loadWorkspace();
    } catch (sendError: any) {
      setError(sendError?.message || 'Campagne verzenden mislukt.');
    } finally {
      setSending(false);
    }
  };

  const saveSettingsPatch = async (patch: Partial<PushSettingsConfig>) => {
    if (!settings) return;

    setError(null);
    setNotice(null);

    try {
      const nextSettings = {
        ...settings,
        ...patch,
        automations: {
          ...settings.automations,
          ...(patch.automations ?? {}),
        },
      };
      const saved = await savePushSettings(nextSettings);
      setSettings(saved);
      setNotice('Pushinstellingen opgeslagen.');
    } catch (settingsError: any) {
      setError(settingsError?.message || 'Pushinstellingen opslaan mislukt.');
    }
  };

  const handleRunAutomations = async () => {
    setSending(true);
    setError(null);
    setNotice(null);

    try {
      const result = await runPushAutomations();
      setNotice(`${result.createdCampaigns?.length ?? 0} automatische campagnes uitgevoerd.`);
      await loadWorkspace();
    } catch (automationError: any) {
      setError(automationError?.message || 'Automaties uitvoeren mislukt.');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="admin-phase-kicker">Pushmeldingen</p>
          <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)]">Meldingen</h2>
          <p className="admin-phase-copy mt-2 max-w-3xl text-sm">
            Stuur relevante pushmeldingen naar klanten die expliciet gekozen hebben voor Cozy meldingen. Breed sturen blijft bewust afgeremd.
          </p>
        </div>

        <div className="admin-phase-identity rounded-[26px] px-5 py-4 text-[var(--color-cozy-text)]">
          <p className="admin-phase-kicker">Actieve admin</p>
          <p className="mt-2 break-all font-mono text-sm font-bold">{adminEmail ?? 'Onbekend'}</p>
        </div>
      </div>

      <div className="admin-phase-tabs inline-flex flex-wrap gap-2 rounded-[26px] p-2">
        {([
          ['compose', 'Opstellen', BellRing],
          ['history', 'Historiek', History],
          ['settings', 'Instellingen', SlidersHorizontal],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className="admin-phase-tab inline-flex items-center justify-center gap-2"
            data-active={mode === key}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-[22px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Actieve toestellen', metrics?.activeSubscriptions ?? 0, Bell],
          ['Push aan', metrics?.pushEnabledCustomers ?? 0, Users],
          ['Promo opt-in', metrics?.promoOptInCustomers ?? 0, Megaphone],
          ['30d campagnes', metrics?.campaignsLast30Days ?? 0, Send],
          ['30d clicks', metrics?.clicksLast30Days ?? 0, CheckCircle],
          ['30d fouten', metrics?.failedDeliveriesLast30Days ?? 0, ShieldAlert],
        ].map(([label, value, Icon]) => (
          <div key={label as string} className="admin-phase-metric rounded-[22px] px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="admin-phase-kicker">{label as string}</p>
              {React.createElement(Icon as React.ElementType, { size: 16, className: 'text-[var(--color-cozy-olive)]' })}
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{String(value)}</p>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {mode === 'compose' && (
          <motion.div key="compose" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="admin-phase-panel rounded-[32px] p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="admin-phase-kicker">Nieuwe melding</p>
                  <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">Opstellen</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft(DEFAULT_DRAFT)}
                  className="admin-phase-button-secondary inline-flex items-center gap-2 px-4 text-sm font-semibold"
                >
                  <RefreshCw size={15} />
                  Reset
                </button>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="admin-phase-label">Titel</span>
                  <input className="admin-phase-input text-base" value={draft.title} maxLength={72} onChange={(event) => updateDraft('title', event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="admin-phase-label">Doelpagina</span>
                  <select className="admin-phase-input text-base" value={draft.deeplink} onChange={(event) => updateDraft('deeplink', event.target.value)}>
                    <option value="/dashboard">Spaarkaart</option>
                    <option value="/rewards">Beloningen</option>
                  </select>
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="admin-phase-label">Bericht</span>
                  <textarea className="admin-phase-input min-h-28 resize-none text-base" value={draft.body} maxLength={180} onChange={(event) => updateDraft('body', event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="admin-phase-label">Soort</span>
                  <select className="admin-phase-input text-base" value={draft.campaignType} onChange={(event) => {
                    const nextType = event.target.value as PushCampaignType;
                    updateDraft('campaignType', nextType);
                    updateDraft('deliveryCategory', nextType === 'promo_open_bottle' || nextType === 'manual_custom' ? 'promo' : nextType.includes('reward') ? 'reward' : 'reminder');
                  }}>
                    <option value="manual_custom">Custom melding</option>
                    <option value="reward_ready">Beloning klaar</option>
                    <option value="reward_reminder">Beloning herinnering</option>
                    <option value="inactivity_reminder">Inactiviteit</option>
                    <option value="promo_open_bottle">Open fles promo</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="admin-phase-label">Doelgroep</span>
                  <select className="admin-phase-input text-base" value={draft.audiencePreset} onChange={(event) => updateDraft('audiencePreset', event.target.value as AudiencePreset)}>
                    <option value="reward">Beloning klaar</option>
                    <option value="inactive">Inactieve trouwe klanten</option>
                    <option value="tier">Loyalty status</option>
                    <option value="favorite">Favoriete drankgroep</option>
                    <option value="single">Specifieke klant</option>
                    <option value="all">Alle opted-in klanten</option>
                  </select>
                </label>
              </div>

              {draft.audiencePreset === 'tier' && (
                <div className="mt-5 grid gap-2 sm:grid-cols-4">
                  {LOYALTY_TIER_ORDER.map((tier) => (
                    <button key={tier} type="button" onClick={() => updateDraft('loyaltyTier', tier)} className={cn('rounded-2xl border px-4 py-3 text-sm font-semibold', draft.loyaltyTier === tier ? 'border-[var(--color-cozy-olive)] bg-white shadow-sm' : 'border-gray-100 bg-white/60')}>
                      {LOYALTY_TIER_CONFIG[tier].label}
                    </button>
                  ))}
                </div>
              )}

              {draft.audiencePreset === 'favorite' && (
                <div className="mt-5 grid gap-2 sm:grid-cols-4">
                  {(['coffee', 'wine', 'beer', 'soda'] as CardType[]).map((type) => (
                    <button key={type} type="button" onClick={() => updateDraft('favoriteDrinkType', type)} className={cn('rounded-2xl border px-4 py-3 text-sm font-semibold', draft.favoriteDrinkType === type ? 'border-[var(--color-cozy-olive)] bg-white shadow-sm' : 'border-gray-100 bg-white/60')}>
                      {cardTypeLabels[type]}
                    </button>
                  ))}
                </div>
              )}

              {draft.audiencePreset === 'inactive' && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="admin-phase-label">Dagen niet bezocht</span>
                    <input className="admin-phase-input text-base" type="number" min={14} max={180} value={draft.inactivityDays} onChange={(event) => updateDraft('inactivityDays', Number(event.target.value))} />
                  </label>
                  <label className="space-y-2">
                    <span className="admin-phase-label">Minimum bezoeken</span>
                    <input className="admin-phase-input text-base" type="number" min={1} max={25} value={draft.minVisits} onChange={(event) => updateDraft('minVisits', Number(event.target.value))} />
                  </label>
                </div>
              )}

              {draft.audiencePreset === 'single' && (
                <div className="mt-5 space-y-3">
                  <div className="admin-phase-panel-soft rounded-[24px] px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Search size={16} className="text-[var(--color-cozy-olive)]" />
                      <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Zoek klant" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {customerOptions.map((customer) => (
                      <button key={customer.id} type="button" onClick={() => updateDraft('customerId', customer.id)} className={cn('rounded-2xl border px-4 py-3 text-left text-sm', draft.customerId === customer.id ? 'border-[var(--color-cozy-olive)] bg-white shadow-sm' : 'border-gray-100 bg-white/60')}>
                        <span className="block font-semibold text-[var(--color-cozy-text)]">{customer.name}</span>
                        <span className="block truncate text-xs text-gray-500">{customer.email || customer.loginEmail}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <aside className="space-y-5">
              <section className="admin-phase-panel rounded-[32px] p-6">
                <p className="admin-phase-kicker">Preview</p>
                <div className="admin-phase-panel-soft mt-4 rounded-[28px] px-5 py-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white p-3 text-[var(--color-cozy-olive)] shadow-sm"><Bell size={20} /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--color-cozy-text)]">{draft.title || 'Titel'}</p>
                      <p className="mt-1 text-sm text-gray-600">{draft.body || 'Bericht'}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="admin-phase-metric rounded-[22px] px-4 py-4">
                    <p className="admin-phase-kicker">Ontvangers</p>
                    <p className="mt-2 font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{estimating ? '...' : recipientCount}</p>
                  </div>
                  <div className="admin-phase-metric rounded-[22px] px-4 py-4">
                    <p className="admin-phase-kicker">Doelgroep</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-cozy-text)]">{buildAudienceLabel(draft)}</p>
                  </div>
                </div>
                {matchingCustomerNames.length > 0 && <p className="admin-phase-muted-note mt-3 text-xs">Voorbeeld: {matchingCustomerNames.join(', ')}</p>}
                <div className="mt-4 space-y-2">
                  {warnings.map((warning) => (
                    <div key={warning} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">{warning}</div>
                  ))}
                </div>
                {confirmBroadSend && <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">Brede verzending. Klik nog een keer op verzenden om te bevestigen.</div>}
                <button type="button" onClick={sendCampaignFromDraft} disabled={sending || recipientCount === 0 || (draft.audiencePreset === 'single' && !draft.customerId)} className="admin-phase-button-primary mt-5 inline-flex w-full items-center justify-center gap-3 px-5 text-base font-semibold disabled:opacity-60">
                  <Send size={17} />
                  {sending ? 'Verzenden...' : confirmBroadSend ? 'Bevestig verzending' : 'Verstuur melding'}
                </button>
              </section>
            </aside>
          </motion.div>
        )}

        {mode === 'history' && (
          <motion.section key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="admin-phase-panel rounded-[32px] p-6 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="admin-phase-kicker">Historiek</p>
                <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">Verzonden campagnes</h3>
              </div>
              <button type="button" onClick={loadWorkspace} className="admin-phase-button-secondary inline-flex items-center gap-2 px-4 text-sm font-semibold"><RefreshCw size={15} /> Vernieuw</button>
            </div>
            <div className="mt-6 grid gap-3">
              {loading && <div className="admin-phase-empty rounded-[24px] px-4 py-5 text-sm text-gray-500">Campagnes laden...</div>}
              {!loading && campaigns.length === 0 && <div className="admin-phase-empty rounded-[24px] px-4 py-5 text-sm text-gray-500">Nog geen pushcampagnes.</div>}
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="admin-phase-list-item rounded-[24px] px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--color-cozy-text)]">{campaign.title}</p>
                      <p className="mt-1 text-sm text-gray-500">{campaign.body}</p>
                      <p className="admin-phase-muted-note mt-2 text-xs">Door {campaign.createdByAdminEmail ?? 'onbekend'} · {formatDateTime(campaign.sentAt ?? campaign.createdAt)}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-2xl bg-white/70 px-3 py-2"><span className="block font-mono text-lg font-bold">{campaign.sentCount}</span>sent</div>
                      <div className="rounded-2xl bg-white/70 px-3 py-2"><span className="block font-mono text-lg font-bold">{campaign.failureCount}</span>fout</div>
                      <div className="rounded-2xl bg-white/70 px-3 py-2"><span className="block font-mono text-lg font-bold">{campaign.clickCount}</span>click</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {mode === 'settings' && (
          <motion.section key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-5 lg:grid-cols-2">
            <div className="admin-phase-panel rounded-[32px] p-6 md:p-8">
              <p className="admin-phase-kicker">Veiligheid</p>
              <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">Globale controles</h3>
              <div className="mt-6 space-y-3">
                <button type="button" onClick={() => saveSettingsPatch({ disableAllPush: !settings?.disableAllPush })} className="admin-phase-list-item flex w-full items-center justify-between rounded-[24px] px-4 py-4 text-left">
                  <span className="inline-flex items-center gap-3 font-semibold text-[var(--color-cozy-text)]">{settings?.disableAllPush ? <PauseCircle size={18} /> : <PlayCircle size={18} />} Alle pushmeldingen</span>
                  <span className="text-sm text-[var(--color-cozy-olive)]">{settings?.disableAllPush ? 'Gepauzeerd' : 'Actief'}</span>
                </button>
                <button type="button" onClick={() => saveSettingsPatch({ promotionsPaused: !settings?.promotionsPaused })} className="admin-phase-list-item flex w-full items-center justify-between rounded-[24px] px-4 py-4 text-left">
                  <span className="inline-flex items-center gap-3 font-semibold text-[var(--color-cozy-text)]"><Megaphone size={18} /> Promoties</span>
                  <span className="text-sm text-[var(--color-cozy-olive)]">{settings?.promotionsPaused ? 'Gepauzeerd' : 'Actief'}</span>
                </button>
              </div>
            </div>

            <div className="admin-phase-panel rounded-[32px] p-6 md:p-8">
              <p className="admin-phase-kicker">Automaties</p>
              <h3 className="mt-2 text-2xl font-display font-bold text-[var(--color-cozy-text)]">Slimme meldingen</h3>
              <div className="mt-6 space-y-3">
                {([
                  ['rewardReady', 'Beloning klaar', Gift],
                  ['rewardReminder', 'Beloning herinnering', Clock3],
                  ['inactivityReminder', 'Inactiviteit 30 dagen', Users],
                ] as const).map(([key, label, Icon]) => (
                  <button key={key} type="button" onClick={() => saveSettingsPatch({ automations: { [key]: !settings?.automations[key] } as any })} className="admin-phase-list-item flex w-full items-center justify-between rounded-[24px] px-4 py-4 text-left">
                    <span className="inline-flex items-center gap-3 font-semibold text-[var(--color-cozy-text)]"><Icon size={18} /> {label}</span>
                    <span className="text-sm text-[var(--color-cozy-olive)]">{settings?.automations[key] ? 'Aan' : 'Uit'}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={handleRunAutomations} disabled={sending} className="admin-phase-button-primary mt-6 inline-flex w-full items-center justify-center gap-3 px-5 text-base font-semibold disabled:opacity-60">
                <RefreshCw size={17} />
                Automaties nu uitvoeren
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
