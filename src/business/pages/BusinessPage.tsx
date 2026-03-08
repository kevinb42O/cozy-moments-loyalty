import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Coffee, Wine, Beer, GlassWater, Plus, Minus, QrCode, LogOut, ChevronDown, CheckCircle, Download, Mail, Star, TrendingUp, Users, Calendar, Award, Trash2, AlertTriangle, Megaphone, Check, X, Gift, Clock3, History, Save } from 'lucide-react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { useBusinessAuth } from '../store/BusinessAuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { useLoyalty, CardType, cardTypeLabels } from '../../shared/store/LoyaltyContext';
import { Screensaver } from '../components/Screensaver';
import { signQrPayload } from '../../shared/lib/qr-crypto';
import { supabase } from '../../shared/lib/supabase';
import {
  LOYALTY_TIER_CONFIG,
  LOYALTY_TIER_ORDER,
  getLoyaltyProgress,
  getLoyaltyTierRank,
  type LoyaltyTier,
} from '../../shared/lib/loyalty-tier';
import {
  buildTransactionSummaryParts,
  emptyDeltaRecord,
  getTransactionLabel,
  rowToTransaction,
  type CustomerTransaction,
  type TransactionEventType,
  validateManualAdjustmentDraft,
} from '../lib/transaction-history';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// ── Admin audio chime (same Web Audio approach as Scanner) ────────────────────
let adminAudioCtx: AudioContext | null = null;

function unlockAdminAudio() {
  try {
    if (!adminAudioCtx || adminAudioCtx.state === 'closed') {
      adminAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (adminAudioCtx.state === 'suspended') adminAudioCtx.resume();
  } catch { /* ignore */ }
}

async function playAdminChime() {
  try {
    if (!adminAudioCtx || adminAudioCtx.state === 'closed') {
      adminAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (adminAudioCtx.state === 'suspended') await adminAudioCtx.resume();
    const ctx = adminAudioCtx;
    const notes = [
      { freq: 660,  start: 0,    duration: 0.18 },
      { freq: 880,  start: 0.15, duration: 0.18 },
      { freq: 1100, start: 0.30, duration: 0.30 },
    ];
    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    });
  } catch { /* ignore */ }
}

// ── Consumption stats helper ─────────────────────────────────────────────────
const MS_PER_MONTH = 30.4375 * 24 * 60 * 60 * 1000;

// Estimated average price per drink type (for revenue estimation)
const PRICE_ESTIMATE: Record<CardType, number> = {
  coffee: 3.00,
  wine: 5.00,
  beer: 4.00,
  soda: 3.00,
};

type BusinessView = 'create' | 'open-bottles' | 'customers' | 'history' | 'redeem';
type OpenBottleRisk = 'red' | 'orange';

interface OpenBottleEntry {
  openedAt: string;
  remainingCount: number;
}

interface OpenBottleProduct {
  id: string;
  name: string;
  priceLabel: string;
  risk: OpenBottleRisk;
  reason: string;
  maxRemainingCount: number;
  unitSingular: string;
  unitPlural: string;
  expiryHours: number;
  promoMessage: string;
}

const OPEN_BOTTLE_PRODUCTS: OpenBottleProduct[] = [
  {
    id: 'champagne-charles-latour',
    name: 'Champagne Charles Latour Glas',
    priceLabel: '€12,50',
    risk: 'red',
    reason: 'Duurste glas op de kaart. De bubbels lopen snel terug, dus deze moet bijna meteen gepusht worden.',
    maxRemainingCount: 5,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 48,
    promoMessage: '🌟 Vandaag in de kijker: Champagne Charles Latour per glas. Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'cava-brisa-nova',
    name: 'Cava Brisa Nova Glas',
    priceLabel: '€8,50',
    risk: 'red',
    reason: 'Zelfde tikkende klok als champagne: open fles, snel actie nodig.',
    maxRemainingCount: 5,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 48,
    promoMessage: '🌟 Vandaag in de kijker: Cava Brisa Nova per glas. Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'altes-espontania-rose',
    name: 'Altés L\'Espontania Rosé Glas',
    priceLabel: '€8,50',
    risk: 'red',
    reason: 'Premium rosé per glas die trager loopt dan de huisrosé.',
    maxRemainingCount: 4,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 72,
    promoMessage: '🌟 Vandaag in de kijker: Altés L\'Espontania Rosé per glas. Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'les-silex-sauvignon',
    name: 'Les Silex Sauvignon',
    priceLabel: '€8,00',
    risk: 'red',
    reason: 'Premium witte wijn. Mooie marge, maar gevoelig als hij maar af en toe besteld wordt.',
    maxRemainingCount: 4,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 72,
    promoMessage: '🌟 Vandaag in de kijker: Les Silex Sauvignon per glas. Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'no-excuse-chardonnay',
    name: 'No Excuse Chardonnay',
    priceLabel: '€7,00',
    risk: 'red',
    reason: 'Premium witte wijn die snel pijn doet als de fles traag draait.',
    maxRemainingCount: 4,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 72,
    promoMessage: '🌟 Vandaag in de kijker: No Excuse Chardonnay per glas. Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'terroir-moelleux',
    name: 'Terroir et Vignobles Moelleux | zoet',
    priceLabel: '€7,00',
    risk: 'red',
    reason: 'Zoete witte wijn is een niche. Zonder extra push blijft die fles vaak staan.',
    maxRemainingCount: 4,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 72,
    promoMessage: '🌟 Vandaag in de kijker: onze zachte Moelleux per glas. Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'keth-pinot-blanc-00',
    name: 'Keth Pinot Blanc 0,0',
    priceLabel: '€7,00',
    risk: 'red',
    reason: 'Alcoholvrije witte wijn met beperkte doelgroep. Groot risico op derving.',
    maxRemainingCount: 4,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 72,
    promoMessage: '🌟 Vandaag in de kijker: onze heerlijke alcoholvrije Pinot Blanc! Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'divin-pinot-noir-00',
    name: 'Divin Pinot Noir 0,0',
    priceLabel: '€7,00',
    risk: 'red',
    reason: 'Alcoholvrije rode wijn is een trage loper. Deze moet meteen zichtbaar gemaakt worden.',
    maxRemainingCount: 4,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 72,
    promoMessage: '🌟 Vandaag in de kijker: onze heerlijke alcoholvrije Pinot Noir! Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'les-rochettes-wit',
    name: 'Les Rochettes Wit',
    priceLabel: '€5,50',
    risk: 'orange',
    reason: 'Huiswijn die meestal goed draait, maar laat op de week wel opgevolgd moet worden.',
    maxRemainingCount: 4,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 72,
    promoMessage: '🌟 Vandaag in de kijker: Les Rochettes Wit per glas. Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'les-rochettes-rood',
    name: 'Les Rochettes Rood Glas',
    priceLabel: '€5,50',
    risk: 'orange',
    reason: 'Huisrode wijn. Minder risicovol, maar nog altijd jammer als de fles blijft hangen.',
    maxRemainingCount: 4,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 72,
    promoMessage: '🌟 Vandaag in de kijker: Les Rochettes Rood per glas. Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'les-rochettes-rose',
    name: 'Les Rochettes Rosé Glas',
    priceLabel: '€5,50',
    risk: 'orange',
    reason: 'Huisrosé. Minder kritiek, maar opvolging blijft zinvol zodra een fles open is.',
    maxRemainingCount: 4,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 72,
    promoMessage: '🌟 Vandaag in de kijker: Les Rochettes Rosé per glas. Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'gris-blanc-rose',
    name: 'Gris Blanc Rosé Glas',
    priceLabel: '€5,50',
    risk: 'orange',
    reason: 'Nog een rosé per glas die opgevolgd moet worden zodra een nieuwe fles open gaat.',
    maxRemainingCount: 4,
    unitSingular: 'glas',
    unitPlural: 'glazen',
    expiryHours: 72,
    promoMessage: '🌟 Vandaag in de kijker: Gris Blanc Rosé per glas. Bestel dit vandaag en scoor een EXTRA stempel op je Wijn-kaart.',
  },
  {
    id: 'lactosevrije-melk',
    name: 'Lactosevrije melk',
    priceLabel: 'Koffie-special',
    risk: 'red',
    reason: 'Een open pak lactosevrije melk is een niche-product. Zodra het open is, wil je snel extra lattes, cappuccino\'s en koffie verkeerd verkopen.',
    maxRemainingCount: 6,
    unitSingular: 'koffie',
    unitPlural: 'koffies',
    expiryHours: 72,
    promoMessage: '🌟 Vandaag in de kijker: Latte, Cappuccino of Koffie Verkeerd met lactosevrije melk. Bestel dit vandaag en scoor een EXTRA stempel op je Koffie-kaart.',
  },
];

const OPEN_BOTTLE_PRODUCT_MAP = OPEN_BOTTLE_PRODUCTS.reduce<Record<string, OpenBottleProduct>>((acc, product) => {
  acc[product.id] = product;
  return acc;
}, {});

function normalizeOpenBottleState(value: unknown): Record<string, OpenBottleEntry> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, OpenBottleEntry>>((acc, [key, entry]) => {
    const product = OPEN_BOTTLE_PRODUCT_MAP[key];
    if (!product) return acc;

    if (
      entry
      && typeof entry === 'object'
      && !Array.isArray(entry)
      && typeof (entry as { openedAt?: unknown }).openedAt === 'string'
    ) {
      const remainingCountRaw = (entry as { remainingCount?: unknown }).remainingCount;
      const remainingCount = typeof remainingCountRaw === 'number'
        ? Math.max(0, Math.min(product.maxRemainingCount, Math.floor(remainingCountRaw)))
        : product.maxRemainingCount;

      acc[key] = {
        openedAt: (entry as { openedAt: string }).openedAt,
        remainingCount,
      };
    }
    return acc;
  }, {});
}

function formatRemainingCount(product: OpenBottleProduct, count: number) {
  const unit = count === 1 ? product.unitSingular : product.unitPlural;
  const prefix = product.id === 'lactosevrije-melk' ? 'Nog' : 'Nog';
  const suffix = product.id === 'lactosevrije-melk' ? 'mogelijk' : 'over';
  return `${prefix} ${count} ${unit} ${suffix}`;
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}u`;
  return `${hours}u ${minutes.toString().padStart(2, '0')}m`;
}

function calcCustomerStats(customer: import('../../shared/store/LoyaltyContext').Customer, nowMs: number) {
  const createdMs = new Date(customer.createdAt).getTime();
  const monthsActive = Math.max(1, (nowMs - createdMs) / MS_PER_MONTH);
  const total: Record<CardType, number> = {
    coffee: (customer.claimedRewards.coffee + customer.rewards.coffee) * 10 + customer.cards.coffee,
    wine:   (customer.claimedRewards.wine   + customer.rewards.wine  ) * 10 + customer.cards.wine,
    beer:   (customer.claimedRewards.beer   + customer.rewards.beer  ) * 10 + customer.cards.beer,
    soda:   (customer.claimedRewards.soda   + customer.rewards.soda  ) * 10 + customer.cards.soda,
  };
  const avgPerMonth: Record<CardType, number> = {
    coffee: total.coffee / monthsActive,
    wine:   total.wine   / monthsActive,
    beer:   total.beer   / monthsActive,
    soda:   total.soda   / monthsActive,
  };
  const grandTotal = total.coffee + total.wine + total.beer + total.soda;

  // Favorite drink
  const types: CardType[] = ['coffee', 'wine', 'beer', 'soda'];
  const favorite = types.reduce((a, b) => total[a] >= total[b] ? a : b);
  const hasFavorite = total[favorite] > 0;

  // Estimated revenue
  const estimatedRevenue = types.reduce((sum, t) => sum + total[t] * PRICE_ESTIMATE[t], 0);

  // Estimated value given away via loyalty card (claimed free rewards)
  const estimatedGivenAway = types.reduce((sum, t) => sum + (customer.claimedRewards?.[t] || 0) * PRICE_ESTIMATE[t], 0);

  // Average per visit
  const avgPerVisit = customer.totalVisits > 0 ? grandTotal / customer.totalVisits : 0;

  // Days since last visit
  const lastVisitMs = customer.lastVisitAt ? new Date(customer.lastVisitAt).getTime() : null;
  const daysSinceLastVisit = lastVisitMs ? Math.floor((nowMs - lastVisitMs) / (24 * 60 * 60 * 1000)) : null;

  const loyaltyProgress = getLoyaltyProgress(customer.loyaltyPoints);

  return {
    total,
    avgPerMonth,
    monthsActive,
    grandTotal,
    favorite,
    hasFavorite,
    estimatedRevenue,
    estimatedGivenAway,
    avgPerVisit,
    daysSinceLastVisit,
    loyaltyTier: customer.loyaltyTier,
    loyaltyPoints: customer.loyaltyPoints,
    loyaltyProgress,
  };
}

export const BusinessPage: React.FC = () => {
  const { customers, refreshCustomers, deleteCustomer, applyManualAdjustment } = useLoyalty();
  const { logout, adminEmail } = useBusinessAuth();

  const loyaltyBadge = (tier: LoyaltyTier) => {
    const config = LOYALTY_TIER_CONFIG[tier];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${config.adminBadgeClassName}`}>
        {config.label}
      </span>
    );
  };

  const [consumptions, setConsumptions] = useState<Record<CardType, number>>({
    coffee: 0,
    wine: 0,
    beer: 0,
    soda: 0,
  });
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrScanned, setQrScanned] = useState(false);
  const [view, setView] = useState<BusinessView>('create');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loyaltyFilter, setLoyaltyFilter] = useState<'all' | LoyaltyTier>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Promo message state
  const [promoMessage, setPromoMessage] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promoEditing, setPromoEditing] = useState(false);
  const [promoSaving, setPromoSaving] = useState(false);
  const [openBottles, setOpenBottles] = useState<Record<string, OpenBottleEntry>>({});
  const [clockNow, setClockNow] = useState(Date.now());
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | TransactionEventType>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedCorrectionCustomerId, setSelectedCorrectionCustomerId] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionStamps, setCorrectionStamps] = useState<Record<CardType, number>>(emptyDeltaRecord);
  const [correctionRewards, setCorrectionRewards] = useState<Record<CardType, number>>(emptyDeltaRecord);
  const [correctionClaimed, setCorrectionClaimed] = useState<Record<CardType, number>>(emptyDeltaRecord);
  const [correctionVisitDelta, setCorrectionVisitDelta] = useState(0);
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);
  // Snapshot of customers when a QR is generated — used to detect when it gets scanned
  const customersSnapshotRef = useRef<string>('');

  // Unlock AudioContext on first tap (needed on iOS/Android)
  useEffect(() => {
    const handler = () => unlockAdminAudio();
    window.addEventListener('touchstart', handler, { once: true, passive: true });
    window.addEventListener('click', handler, { once: true, passive: true });
    return () => {
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('click', handler);
    };
  }, []);

  // Always fetch fresh data when the customers tab is opened
  useEffect(() => {
    if (view === 'customers' || view === 'history') refreshCustomers();
  }, [view]);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const loadSiteSettings = useCallback(async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('site_settings')
      .select('promo_message, open_bottles')
      .eq('id', 'default')
      .single();

    if (error) {
      console.error('Kon site_settings niet laden:', error);
      return;
    }

    const nextPromo = data?.promo_message ?? '';
    setPromoMessage(nextPromo);
    setPromoInput(current => promoEditing ? current : nextPromo);
    setOpenBottles(normalizeOpenBottleState((data as { open_bottles?: unknown } | null)?.open_bottles));
  }, [promoEditing]);

  // Fetch promo message + open bottles and keep in sync across devices
  useEffect(() => {
    if (!supabase) return;

    loadSiteSettings();

    const channel = supabase
      .channel('site-settings-realtime-business')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => {
        loadSiteSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSiteSettings]);

  const persistSiteSettings = useCallback(async (
    nextPromoMessage: string,
    nextOpenBottles: Record<string, OpenBottleEntry>
  ) => {
    setPromoMessage(nextPromoMessage);
    setOpenBottles(nextOpenBottles);

    if (!supabase) return true;

    setPromoSaving(true);
    const { error } = await supabase
      .from('site_settings')
      .update({
        promo_message: nextPromoMessage,
        open_bottles: nextOpenBottles,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default');
    setPromoSaving(false);

    if (error) {
      console.error('Kon site_settings niet opslaan:', error);
      return false;
    }

    return true;
  }, []);

  const savePromo = async (msg: string) => {
    const ok = await persistSiteSettings(msg, openBottles);
    if (!ok) return;
    setPromoInput(msg);
    setPromoEditing(false);
  };

  const handleOpenBottle = async (productId: string) => {
    const product = OPEN_BOTTLE_PRODUCT_MAP[productId];
    if (!product) return;

    const nextOpenBottles = {
      ...openBottles,
      [productId]: {
        openedAt: new Date().toISOString(),
        remainingCount: product.maxRemainingCount,
      },
    };
    await persistSiteSettings(promoMessage, nextOpenBottles);
  };

  const handleSoldUnit = async (productId: string) => {
    const product = OPEN_BOTTLE_PRODUCT_MAP[productId];
    const entry = openBottles[productId];
    if (!product || !entry) return;

    const nextRemainingCount = Math.max(0, entry.remainingCount - 1);
    const nextOpenBottles = { ...openBottles };

    if (nextRemainingCount === 0) {
      delete nextOpenBottles[productId];
    } else {
      nextOpenBottles[productId] = {
        ...entry,
        remainingCount: nextRemainingCount,
      };
    }

    const nextPromo = nextRemainingCount === 0 && promoMessage === product.promoMessage
      ? ''
      : promoMessage;

    await persistSiteSettings(nextPromo, nextOpenBottles);
  };

  const handleClearBottle = async (productId: string) => {
    const nextOpenBottles = { ...openBottles };
    delete nextOpenBottles[productId];

    const nextPromo = OPEN_BOTTLE_PRODUCTS.find(product => product.id === productId)?.promoMessage === promoMessage
      ? ''
      : promoMessage;

    await persistSiteSettings(nextPromo, nextOpenBottles);
  };

  const handlePromoteBottle = async (product: OpenBottleProduct) => {
    if (!openBottles[product.id]) return;
    setPromoInput(product.promoMessage);
    setPromoEditing(false);
    await persistSiteSettings(product.promoMessage, openBottles);
  };

  const activePromoProduct = OPEN_BOTTLE_PRODUCTS.find(product => product.promoMessage === promoMessage) ?? null;

  const loadTransactions = useCallback(async () => {
    if (!supabase) {
      setTransactions([]);
      setTransactionsError('Supabase niet geconfigureerd');
      return;
    }

    setTransactionsLoading(true);
    setTransactionsError(null);

    const { data, error } = await supabase
      .from('customer_transactions')
      .select(`
        id,
        customer_id,
        event_type,
        staff_email,
        reason,
        tx_id,
        coffee_stamp_delta,
        wine_stamp_delta,
        beer_stamp_delta,
        soda_stamp_delta,
        coffee_reward_delta,
        wine_reward_delta,
        beer_reward_delta,
        soda_reward_delta,
        coffee_claimed_delta,
        wine_claimed_delta,
        beer_claimed_delta,
        soda_claimed_delta,
        visit_delta,
        metadata,
        created_at,
        customers(name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(120);

    if (error) {
      console.error('Kon transactiehistoriek niet laden:', error);
      setTransactionsError(error.message);
      setTransactionsLoading(false);
      return;
    }

    setTransactions((data ?? []).map(rowToTransaction));
    setTransactionsLoading(false);
  }, []);

  useEffect(() => {
    if (view !== 'history' || !supabase) return;

    loadTransactions();

    const channel = supabase
      .channel('customer-transactions-realtime-business')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_transactions' }, () => {
        loadTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [view, loadTransactions]);

  const resetCorrectionForm = useCallback(() => {
    setSelectedCorrectionCustomerId('');
    setCorrectionReason('');
    setCorrectionStamps(emptyDeltaRecord());
    setCorrectionRewards(emptyDeltaRecord());
    setCorrectionClaimed(emptyDeltaRecord());
    setCorrectionVisitDelta(0);
  }, []);

  const changeCorrectionRecord = useCallback(
    (
      section: 'stamps' | 'rewards' | 'claimed',
      type: CardType,
      nextValue: number,
    ) => {
      if (section === 'stamps') {
        setCorrectionStamps(prev => ({ ...prev, [type]: nextValue }));
      } else if (section === 'rewards') {
        setCorrectionRewards(prev => ({ ...prev, [type]: nextValue }));
      } else {
        setCorrectionClaimed(prev => ({ ...prev, [type]: nextValue }));
      }
    },
    [],
  );

  const submitManualCorrection = useCallback(async () => {
    setCorrectionError(null);
    setCorrectionSuccess(null);

    const validationError = validateManualAdjustmentDraft({
      customerId: selectedCorrectionCustomerId,
      reason: correctionReason,
      stamps: correctionStamps,
      rewards: correctionRewards,
      claimedRewards: correctionClaimed,
      visitDelta: correctionVisitDelta,
    });

    if (validationError) {
      setCorrectionError(validationError);
      return;
    }

    setCorrectionSaving(true);
    try {
      await applyManualAdjustment({
        customerId: selectedCorrectionCustomerId,
        staffEmail: adminEmail,
        reason: correctionReason.trim(),
        stamps: correctionStamps,
        rewards: correctionRewards,
        claimedRewards: correctionClaimed,
        visitDelta: correctionVisitDelta,
      });
      await loadTransactions();
      setCorrectionSuccess('Correctie opgeslagen en toegevoegd aan de historiek.');
      resetCorrectionForm();
    } catch (error: any) {
      setCorrectionError(error?.message || 'Correctie opslaan mislukt.');
    } finally {
      setCorrectionSaving(false);
    }
  }, [
    correctionClaimed,
    correctionReason,
    correctionRewards,
    correctionStamps,
    correctionVisitDelta,
    selectedCorrectionCustomerId,
    applyManualAdjustment,
    adminEmail,
    loadTransactions,
    resetCorrectionForm,
  ]);

  const filteredTransactions = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return transactions.filter(transaction => {
      if (historyFilter !== 'all' && transaction.eventType !== historyFilter) return false;
      if (!query) return true;

      return transaction.customerName.toLowerCase().includes(query)
        || transaction.customerEmail.toLowerCase().includes(query)
        || (transaction.staffEmail ?? '').toLowerCase().includes(query)
        || (transaction.reason ?? '').toLowerCase().includes(query);
    });
  }, [historyFilter, historySearch, transactions]);

  const sortedCustomers = useMemo(
    () => [...customers].sort((left, right) => {
      const tierRankDelta = getLoyaltyTierRank(right.loyaltyTier) - getLoyaltyTierRank(left.loyaltyTier);
      if (tierRankDelta !== 0) return tierRankDelta;
      if (right.loyaltyPoints !== left.loyaltyPoints) return right.loyaltyPoints - left.loyaltyPoints;
      const rightLastVisit = right.lastVisitAt ? new Date(right.lastVisitAt).getTime() : 0;
      const leftLastVisit = left.lastVisitAt ? new Date(left.lastVisitAt).getTime() : 0;
      if (rightLastVisit !== leftLastVisit) return rightLastVisit - leftLastVisit;
      return left.name.localeCompare(right.name, 'nl-BE');
    }),
    [customers],
  );

  const handleIncrement = (type: CardType) => {
    setConsumptions(prev => ({ ...prev, [type]: prev[type] + 1 }));
  };

  const handleDecrement = (type: CardType) => {
    setConsumptions(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
  };

  const generateQR = async () => {
    if (consumptions.coffee === 0 && consumptions.wine === 0 && consumptions.beer === 0 && consumptions.soda === 0) return;
    customersSnapshotRef.current = JSON.stringify(customers);
    const payload = {
      ...consumptions,
      staffEmail: adminEmail,
      txId: Math.random().toString(36).substring(7),
      timestamp: Date.now()
    };
    setQrPayload(await signQrPayload(payload));
  };

  const reset = () => {
    setConsumptions({ coffee: 0, wine: 0, beer: 0, soda: 0 });
    setQrPayload(null);
    setQrScanned(false);
    customersSnapshotRef.current = '';
  };

  // ── QR scan detection ──────────────────────────────────────────────────────
  // Strategy 1: React to customers state change (Supabase Realtime fires → fetchFromSupabase → new customers)
  // Strategy 2: Poll every 3 seconds while QR is shown (fallback if Realtime not enabled in Supabase dashboard)
  const checkScanned = useCallback(() => {
    if (!qrPayload || qrScanned || !customersSnapshotRef.current) return;
    const current = JSON.stringify(customers);
    if (current !== customersSnapshotRef.current) {
      setQrScanned(true);
      playAdminChime();
    }
  }, [qrPayload, qrScanned, customers]);

  // Fires whenever customers state changes (Realtime path)
  useEffect(() => { checkScanned(); }, [customers, checkScanned]);

  // Poll every 3s as fallback
  useEffect(() => {
    if (!qrPayload || qrScanned) return;
    const interval = setInterval(async () => {
      await refreshCustomers();
      // checkScanned will run via the [customers] effect after state updates
    }, 3000);
    return () => clearInterval(interval);
  }, [qrPayload, qrScanned, refreshCustomers]);

  // Once scanned — auto-close after 2 seconds
  useEffect(() => {
    if (!qrScanned) return;
    const t = setTimeout(() => {
      setConsumptions({ coffee: 0, wine: 0, beer: 0, soda: 0 });
      setQrPayload(null);
      setQrScanned(false);
      customersSnapshotRef.current = '';
    }, 2000);
    return () => clearTimeout(t);
  }, [qrScanned]);

  // Auto-reset QR after 60 seconds (hard safety net)
  useEffect(() => {
    if (!qrPayload) return;
    const t = setTimeout(() => reset(), 60_000);
    return () => clearTimeout(t);
  }, [qrPayload]);

  const totalConsumptions = consumptions.coffee + consumptions.wine + consumptions.beer + consumptions.soda;

  return (
    <div className="min-h-screen bg-[#f5f5f0] pb-24">
      {/* Screensaver — activates after 60s idle, disappears on touch */}
      <Screensaver onWake={() => { /* admin is back */ }} />

      {/* WebaanZee credit — fixed bottom right, all tabs */}
      <a
        href="https://www.webaanzee.be"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-5 flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity z-50"
        style={{ fontSize: '10px', letterSpacing: '0.04em', textDecoration: 'none' }}
      >
        <span style={{ color: '#111', fontWeight: 500 }}>realisatie door </span>
        <span style={{ fontWeight: 700 }}>
          <span style={{ color: '#111' }}>Web</span><span style={{ color: '#f59e0b' }}>aan</span><span style={{ color: '#111' }}>Zee</span>
        </span>
      </a>

      <header className="bg-white px-6 py-2 rounded-b-[28px] shadow-sm mb-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="w-10" />
          <div className="flex items-center">
            <img src="/cozylogo.png" alt="COZY Moments" className="w-20 h-20 object-contain" />
          </div>
          <button
            onClick={logout}
            title="Uitloggen"
            className="w-10 h-10 bg-gray-100 hover:bg-red-50 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"
          >
            <LogOut size={18} />
          </button>
        </div>
        
        <div className="grid grid-cols-5 gap-1 bg-gray-100 p-1 rounded-[22px] mb-1">
          <button
            onClick={() => { reset(); setView('create'); }}
            className={cn(
              "py-2 px-2 rounded-full text-xs md:text-sm font-display font-bold transition-all",
              view === 'create' ? "bg-white shadow text-[var(--color-cozy-olive)]" : "text-gray-500"
            )}
          >
            Nieuwe QR
          </button>
          <button
            onClick={() => { reset(); setView('open-bottles'); }}
            className={cn(
              "py-2 px-2 rounded-full text-xs md:text-sm font-display font-bold transition-all",
              view === 'open-bottles' ? "bg-white shadow text-[var(--color-cozy-olive)]" : "text-gray-500"
            )}
          >
            Open flessen
          </button>
          <button
            onClick={() => { reset(); setView('customers'); }}
            className={cn(
              "py-2 px-2 rounded-full text-xs md:text-sm font-display font-bold transition-all",
              view === 'customers' ? "bg-white shadow text-[var(--color-cozy-olive)]" : "text-gray-500"
            )}
          >
            Klanten
          </button>
          <button
            onClick={() => { reset(); setView('history'); }}
            className={cn(
              "py-2 px-2 rounded-full text-xs md:text-sm font-display font-bold transition-all",
              view === 'history' ? "bg-white shadow text-[var(--color-cozy-olive)]" : "text-gray-500"
            )}
          >
            Historiek
          </button>
          <button
            onClick={() => { reset(); setView('redeem'); }}
            className={cn(
              "py-2 px-2 rounded-full text-xs md:text-sm font-display font-bold transition-all",
              view === 'redeem' ? "bg-white shadow text-[var(--color-cozy-olive)]" : "text-gray-500"
            )}
          >
            Inwisselen
          </button>
        </div>
      </header>

      <main className="px-6">
        {view === 'create' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {!qrPayload ? (
              <div className="space-y-6">
                <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)] mb-8">
                  Selecteer Consumpties
                </h2>
                
                <ConsumptionRow 
                  type="coffee" 
                  title="Koffie" 
                  icon={Coffee} 
                  count={consumptions.coffee} 
                  onInc={() => handleIncrement('coffee')} 
                  onDec={() => handleDecrement('coffee')}
                  color="text-[var(--color-cozy-coffee)]"
                  bg="bg-[#e8dcc8]"
                  index={0}
                />
                
                <ConsumptionRow 
                  type="wine" 
                  title="Wijn" 
                  icon={Wine} 
                  count={consumptions.wine} 
                  onInc={() => handleIncrement('wine')} 
                  onDec={() => handleDecrement('wine')}
                  color="text-[var(--color-cozy-wine)]"
                  bg="bg-[#f0d8dc]"
                  index={1}
                />
                
                <ConsumptionRow 
                  type="beer" 
                  title="Bier" 
                  icon={Beer} 
                  count={consumptions.beer} 
                  onInc={() => handleIncrement('beer')} 
                  onDec={() => handleDecrement('beer')}
                  color="text-[var(--color-cozy-beer)]"
                  bg="bg-[#fcf4d9]"
                  index={2}
                />

                <ConsumptionRow 
                  type="soda" 
                  title="Frisdrank" 
                  icon={GlassWater} 
                  count={consumptions.soda} 
                  onInc={() => handleIncrement('soda')} 
                  onDec={() => handleDecrement('soda')}
                  color="text-[var(--color-cozy-soda)]"
                  bg="bg-[#fce4f0]"
                  index={3}
                />

                <motion.button
                  onClick={generateQR}
                  disabled={totalConsumptions === 0}
                  animate={totalConsumptions > 0 ? { scale: [1, 1.025, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className={cn(
                    "w-full mt-8 rounded-full py-4 px-6 flex items-center justify-center gap-3 transition-all duration-300",
                    totalConsumptions > 0 
                      ? "bg-gradient-to-r from-[#f0ebe0] to-[#e4dccf] border border-[var(--color-cozy-olive)]/25 text-[var(--color-cozy-text)] shadow-md active:scale-[0.98]" 
                      : "bg-gray-100 text-gray-400 cursor-not-allowed border border-transparent"
                  )}
                >
                  <QrCode size={24} />
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={totalConsumptions > 0 ? 'active' : 'inactive'}
                      initial={{ opacity: 0.5, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="font-serif font-semibold text-lg tracking-wide"
                    >
                      Genereer QR Code
                    </motion.span>
                  </AnimatePresence>
                </motion.button>

                {/* Watermark in whitespace */}
                <div className="flex justify-center pt-16 pb-4 pointer-events-none select-none">
                  <img src="/cozylogo.png" alt="" aria-hidden="true" className="w-48 h-48 object-contain opacity-10" />
                </div>
              </div>
            ) : qrScanned ? (
              <motion.div
                key="scanned-create"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="w-24 h-24 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle size={48} className="text-green-500" />
                </div>
                <h3 className="text-2xl font-serif font-semibold text-[var(--color-cozy-text)] mb-2">QR gescand!</h3>
                <p className="text-gray-500">Transactie verwerkt — scherm sluit automatisch</p>
              </motion.div>
            ) : (
              <div className="relative flex flex-col items-center justify-center py-8">
                <img
                  src="/cozylogo.png"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 object-contain opacity-10"
                />
                <div className="relative bg-white p-8 rounded-[40px] shadow-xl mb-8">
                  <QRCodeSVG value={qrPayload} size={240} level="H" />
                </div>
                <h3 className="text-2xl font-serif font-semibold text-[var(--color-cozy-text)] mb-2">
                  Laat de klant scannen
                </h3>
                <p className="text-gray-500 text-center mb-8">
                  {consumptions.coffee > 0 && `${consumptions.coffee} Koffie `}
                  {consumptions.wine > 0 && `${consumptions.wine} Wijn `}
                  {consumptions.beer > 0 && `${consumptions.beer} Bier `}
                  {consumptions.soda > 0 && `${consumptions.soda} Frisdrank `}
                </p>
                <button
                  onClick={reset}
                  className="bg-white text-[var(--color-cozy-text)] border border-gray-200 rounded-full py-3 px-8 shadow-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Nieuwe Transactie
                </button>
                <div className="flex justify-center pt-16 pb-4 pointer-events-none select-none">
                  <img src="/cozylogo.png" alt="" aria-hidden="true" className="w-48 h-48 object-contain opacity-10" />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {view === 'open-bottles' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)]">
                  Open flessen
                </h2>
                <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                  Hier staan enkel de risico-items: de 12 wijnen per glas plus lactosevrije melk. Open iets, volg de timer en zet het met 1 tik in de kijker voor klanten.
                </p>
              </div>
              <div className="hidden md:grid grid-cols-3 gap-2 min-w-[320px]">
                <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Open nu</p>
                  <p className="font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{Object.keys(openBottles).length}</p>
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Over tijd</p>
                  <p className="font-mono text-2xl font-bold text-red-500">
                    {
                      OPEN_BOTTLE_PRODUCTS.filter(product => {
                        const entry = openBottles[product.id];
                        if (!entry) return false;
                        return new Date(entry.openedAt).getTime() + product.expiryHours * 60 * 60 * 1000 <= clockNow;
                      }).length
                    }
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">In promo</p>
                  <p className="font-mono text-2xl font-bold text-[var(--color-cozy-olive)]">{activePromoProduct ? '1' : '0'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[24px] shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone size={16} className="text-[var(--color-cozy-olive)]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Wat klanten nu zien</span>
              </div>
              {promoMessage ? (
                <div className="rounded-2xl border border-[var(--color-cozy-olive)]/15 bg-[var(--color-cozy-olive)]/8 px-4 py-3">
                  <p className="text-sm text-[var(--color-cozy-text)]/85 leading-snug">{promoMessage}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activePromoProduct && (
                      <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--color-cozy-olive)] shadow-sm">
                        Actieve fles: {activePromoProduct.name}
                      </span>
                    )}
                    <button
                      onClick={() => savePromo('')}
                      disabled={promoSaving}
                      className="text-xs text-red-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      Promo wissen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400">
                  Er staat momenteel geen banner live voor klanten.
                </div>
              )}
            </div>

            {(['red', 'orange'] as OpenBottleRisk[]).map(risk => {
              const products = OPEN_BOTTLE_PRODUCTS.filter(product => product.risk === risk);
              const riskConfig = risk === 'red'
                ? {
                    title: 'Code rood: absolute prioriteit',
                    note: 'Absolute prioriteit. Open flessen in deze groep moeten actief verkocht worden.',
                    badge: 'bg-red-50 text-red-600 border-red-200',
                  }
                : {
                    title: 'Code oranje: huiswijnen',
                    note: 'Minder kritiek, maar wel opvolgen zodra laat op de week een nieuwe fles open gaat.',
                    badge: 'bg-amber-50 text-amber-700 border-amber-200',
                  };

              return (
                <div key={risk} className="space-y-3">
                  <div className="flex items-center gap-3 pt-2">
                    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider', riskConfig.badge)}>
                      {riskConfig.title}
                    </span>
                    <p className="text-sm text-gray-500">{riskConfig.note}</p>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {products.map(product => {
                      const entry = openBottles[product.id];
                      const openedAtMs = entry ? new Date(entry.openedAt).getTime() : null;
                      const expiresAtMs = openedAtMs ? openedAtMs + product.expiryHours * 60 * 60 * 1000 : null;
                      const remainingMs = expiresAtMs ? expiresAtMs - clockNow : null;
                      const isExpired = remainingMs !== null && remainingMs <= 0;
                      const isActive = Boolean(entry);
                      const isPromoActive = promoMessage === product.promoMessage;
                      const remainingLabel = entry
                        ? formatRemainingCount(product, entry.remainingCount)
                        : formatRemainingCount(product, product.maxRemainingCount);
                      const soldButtonLabel = product.id === 'lactosevrije-melk'
                        ? '1 koffie verkocht'
                        : '1 glas verkocht';

                      return (
                        <div
                          key={product.id}
                          className={cn(
                            'rounded-[24px] border p-4 shadow-sm transition-colors',
                            isPromoActive
                              ? 'bg-[var(--color-cozy-olive)]/5 border-[var(--color-cozy-olive)]/20'
                              : isActive
                                ? 'bg-white border-gray-200'
                                : 'bg-white/70 border-gray-100'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className={cn(
                                  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
                                  product.risk === 'red'
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                )}>
                                  {product.risk === 'red' ? 'Code rood' : 'Code oranje'}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                                  {product.priceLabel}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                                  {remainingLabel}
                                </span>
                              </div>
                              <h3 className="text-lg font-display font-bold text-[var(--color-cozy-text)] leading-tight">
                                {product.name}
                              </h3>
                              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{product.reason}</p>
                            </div>

                            <div className={cn(
                              'min-w-[120px] rounded-2xl border px-3 py-2 text-center',
                              !isActive
                                ? 'bg-gray-50 border-gray-100 text-gray-400'
                                : isExpired
                                  ? 'bg-red-50 border-red-200 text-red-600'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            )}>
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <Clock3 size={14} />
                                <span className="text-[10px] uppercase tracking-wider font-semibold">Timer</span>
                              </div>
                              <p className="font-mono text-sm font-bold">
                                {!isActive
                                  ? 'Niet open'
                                  : isExpired
                                    ? `${formatDuration(Math.abs(remainingMs ?? 0))} te laat`
                                    : formatDuration(remainingMs ?? 0)}
                              </p>
                              <p className="text-[10px] mt-1 opacity-80">
                                {!isActive
                                  ? `${product.expiryHours}u venster`
                                  : isExpired
                                    ? 'Tijd om te duwen of af te sluiten'
                                    : 'Tijd resterend'}
                              </p>
                            </div>
                          </div>

                          {entry && (
                            <p className="text-xs text-gray-400 mt-3">
                              Open sinds {new Date(entry.openedAt).toLocaleString('nl-BE', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 mt-4">
                            <button
                              onClick={() => handleOpenBottle(product.id)}
                              disabled={promoSaving}
                              className="rounded-full bg-[var(--color-cozy-olive)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {entry ? 'Timer herstarten' : '+ Nieuwe fles'}
                            </button>
                            <button
                              onClick={() => handlePromoteBottle(product)}
                              disabled={!entry || promoSaving}
                              className={cn(
                                'rounded-full px-4 py-2 text-sm font-medium transition-all',
                                isPromoActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-white text-[var(--color-cozy-text)] border border-gray-200 hover:bg-gray-50',
                                (!entry || promoSaving) && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              {isPromoActive ? 'Nu in promo' : 'Zet in promo'}
                            </button>
                            {entry && (
                              <button
                                onClick={() => handleSoldUnit(product.id)}
                                disabled={promoSaving}
                                className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 active:scale-[0.98] transition-all disabled:opacity-50"
                              >
                                {soldButtonLabel}
                              </button>
                            )}
                            {entry && (
                              <button
                                onClick={() => handleClearBottle(product.id)}
                                disabled={promoSaving}
                                className="rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-100 active:scale-[0.98] transition-all disabled:opacity-50"
                              >
                                Fles weg
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {view === 'customers' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)]">
                Klanten Overzicht
              </h2>
              <button
                onClick={() => {
                  const now = new Date();
                  const dateStr = now.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  const timeStr = now.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
                  const fileDate = now.toISOString().slice(0, 10);

                  // ── Helper: trigger a download ─────────────────────
                  const download = (content: string, filename: string, mime: string) => {
                    const BOM = '\uFEFF'; // UTF-8 BOM so Excel reads accents correctly
                    const blob = new Blob([BOM + content], { type: `${mime};charset=utf-8` });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  };

                  // ── Pre-compute stats for all customers ────────────
                  const nowMs = now.getTime();
                  const exportCustomers = sortedCustomers;
                  const allStats = exportCustomers.map(c => calcCustomerStats(c, nowMs));
                  const grandTotal = {
                    coffee: allStats.reduce((s, st) => s + st.total.coffee, 0),
                    wine:   allStats.reduce((s, st) => s + st.total.wine,   0),
                    beer:   allStats.reduce((s, st) => s + st.total.beer,   0),
                    soda:   allStats.reduce((s, st) => s + st.total.soda,   0),
                  };

                  // ── 1. CSV (Excel / nieuwsbrief import) ────────────
                  // Belgian/Dutch Excel uses semicolons as separator
                  const SEP = ';';
                  const csvHeader = ['Naam','Email','Level','Level_Punten','Koffie_Stempels','Wijn_Stempels','Bier_Stempels','Frisdrank_Stempels','Koffie_Volle_Kaarten','Wijn_Volle_Kaarten','Bier_Volle_Kaarten','Frisdrank_Volle_Kaarten','Koffie_Ingewisseld','Wijn_Ingewisseld','Bier_Ingewisseld','Frisdrank_Ingewisseld','Koffie_Totaal','Wijn_Totaal','Bier_Totaal','Frisdrank_Totaal','Koffie_Gem_Maand','Wijn_Gem_Maand','Bier_Gem_Maand','Frisdrank_Gem_Maand','Totaal_Bezoeken','Laatste_Bezoek','Geschatte_Omzet','Loyaliteitskorting','Klant_Sinds'].join(SEP);
                  const csvRows = exportCustomers.map((c, idx) => {
                    const st = allStats[idx];
                    const name = `"${c.name.replace(/"/g, '""')}"`;
                    const email = `"${(c.email || '').replace(/"/g, '""')}"`;
                    const since = new Date(c.createdAt).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const lastVisit = c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
                    return [name, email, LOYALTY_TIER_CONFIG[c.loyaltyTier].label, c.loyaltyPoints, c.cards.coffee, c.cards.wine, c.cards.beer, c.cards.soda, c.rewards.coffee || 0, c.rewards.wine || 0, c.rewards.beer || 0, c.rewards.soda || 0, c.claimedRewards?.coffee || 0, c.claimedRewards?.wine || 0, c.claimedRewards?.beer || 0, c.claimedRewards?.soda || 0, st.total.coffee, st.total.wine, st.total.beer, st.total.soda, st.avgPerMonth.coffee.toFixed(1), st.avgPerMonth.wine.toFixed(1), st.avgPerMonth.beer.toFixed(1), st.avgPerMonth.soda.toFixed(1), c.totalVisits || 0, lastVisit, `€${st.estimatedRevenue.toFixed(2)}`, `€${st.estimatedGivenAway.toFixed(2)}`, since].join(SEP);
                  });
                  const csvTotalsRow = ['"TOTAAL ALLE KLANTEN"', '', '', '', '', '', '', '', '', '', '', '', '', '', grandTotal.coffee, grandTotal.wine, grandTotal.beer, grandTotal.soda, '', '', '', '', ''].join(SEP);
                  download([csvHeader, ...csvRows, '', csvTotalsRow].join('\n'), `cozy-moments-klanten-${fileDate}.csv`, 'text/csv');

                  // ── 2. TXT (leesbaar overzicht) ────────────────────
                  const lines: string[] = [
                    '════════════════════════════════════════════════════',
                    '         COZY MOMENTS — KLANTENEXPORT',
                    `         ${dateStr} om ${timeStr}`,
                    '════════════════════════════════════════════════════',
                    '',
                    `Totaal aantal klanten: ${customers.length}`,
                    '',
                  ];
                  exportCustomers.forEach((c, i) => {
                    const st = allStats[i];
                    const since = new Date(c.createdAt).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const lastVisit = c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
                    lines.push('────────────────────────────────────────');
                    lines.push(`${i + 1}. ${c.name}`);
                    lines.push(`   E-mail:        ${c.email || '—'}`);
                    lines.push(`   Level:         ${LOYALTY_TIER_CONFIG[c.loyaltyTier].label} (${c.loyaltyPoints} punten)`);
                    lines.push(`   Klant sinds:   ${since}`);
                    lines.push(`   Laatste bezoek: ${lastVisit}`);
                    lines.push(`   Totaal bezoeken: ${c.totalVisits || 0}`);
                    lines.push(`   Favoriet:      ${st.hasFavorite ? cardTypeLabels[st.favorite] : '—'}`);
                    lines.push(`   Geschatte omzet: €${st.estimatedRevenue.toFixed(2)}`);
                    lines.push(`   Loyaliteitskorting: €${st.estimatedGivenAway.toFixed(2)}`);
                    lines.push(`   Totaal:        Koffie: ${st.total.coffee}  |  Wijn: ${st.total.wine}  |  Bier: ${st.total.beer}  |  Frisdrank: ${st.total.soda}`);
                    lines.push(`   Gem/maand:     Koffie: ${st.avgPerMonth.coffee.toFixed(1)}  |  Wijn: ${st.avgPerMonth.wine.toFixed(1)}  |  Bier: ${st.avgPerMonth.beer.toFixed(1)}  |  Frisdrank: ${st.avgPerMonth.soda.toFixed(1)}`);
                    lines.push(`   Stempels:      Koffie: ${c.cards.coffee}/10  |  Wijn: ${c.cards.wine}/10  |  Bier: ${c.cards.beer}/10  |  Frisdrank: ${c.cards.soda}/10`);
                    lines.push(`   Volle kaarten: Koffie: ${c.rewards.coffee || 0}  |  Wijn: ${c.rewards.wine || 0}  |  Bier: ${c.rewards.beer || 0}  |  Frisdrank: ${c.rewards.soda || 0}`);
                    lines.push(`   Ingewisseld:   Koffie: ${c.claimedRewards?.coffee || 0}  |  Wijn: ${c.claimedRewards?.wine || 0}  |  Bier: ${c.claimedRewards?.beer || 0}  |  Frisdrank: ${c.claimedRewards?.soda || 0}`);
                    lines.push('');
                  });
                  lines.push('════════════════════════════════════════════════════');
                  lines.push('  TOTAAL VERKOCHT — ALLE KLANTEN SAMEN');
                  lines.push('════════════════════════════════════════════════════');
                  lines.push(`  Koffie:    ${grandTotal.coffee} consumpties`);
                  lines.push(`  Wijn:      ${grandTotal.wine} consumpties`);
                  lines.push(`  Bier:      ${grandTotal.beer} consumpties`);
                  lines.push(`  Frisdrank: ${grandTotal.soda} consumpties`);
                  lines.push('');
                  lines.push('Geëxporteerd door Cozy Moments Loyalty');

                  // Small delay so the browser doesn't block the second download
                  setTimeout(() => {
                    download(lines.join('\n'), `cozy-moments-klanten-${fileDate}.txt`, 'text/plain');
                  }, 300);
                }}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-full py-2 px-4 text-sm font-medium text-[var(--color-cozy-text)] shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
              >
                <Download size={16} />
                Export
              </button>
            </div>

            {/* ── Promo bericht ───────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone size={16} className="text-[var(--color-cozy-olive)]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Promo bericht voor klanten</span>
              </div>
              {promoEditing ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={e => setPromoInput(e.target.value)}
                    maxLength={120}
                    placeholder="bv. Vandaag 2e koffie gratis!"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-[var(--color-cozy-text)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-cozy-olive)] transition"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') savePromo(promoInput.trim()); else if (e.key === 'Escape') { setPromoInput(promoMessage); setPromoEditing(false); } }}
                  />
                  <button
                    onClick={() => savePromo(promoInput.trim())}
                    disabled={promoSaving}
                    className="w-10 h-10 rounded-xl bg-[var(--color-cozy-olive)] text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={() => { setPromoInput(promoMessage); setPromoEditing(false); }}
                    className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setPromoEditing(true)}
                  className="w-full text-left bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                >
                  {promoMessage ? (
                    <span className="text-[var(--color-cozy-text)]">{promoMessage}</span>
                  ) : (
                    <span className="text-gray-400 italic">Tik om een promo bericht in te stellen...</span>
                  )}
                </button>
              )}
              {promoMessage && !promoEditing && (
                <button
                  onClick={() => savePromo('')}
                  className="mt-2 text-xs text-red-400 hover:text-red-500 transition-colors"
                >
                  Promo verwijderen
                </button>
              )}
            </div>

            {/* ── Dashboard Summary Cards ─────────────────────────── */}
            {(() => {
              const nowMs = Date.now();
              const allStats = customers.map(c => calcCustomerStats(c, nowMs));
              const totalConsAll = allStats.reduce((s, st) => s + st.grandTotal, 0);
              const totalRevenueAll = allStats.reduce((s, st) => s + st.estimatedRevenue, 0);
              const totalGivenAwayAll = allStats.reduce((s, st) => s + st.estimatedGivenAway, 0);
              const activeThisMonth = customers.filter(c => {
                if (!c.lastVisitAt) return false;
                const d = new Date(c.lastVisitAt);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length;
              const totalVisitsAll = customers.reduce((s, c) => s + (c.totalVisits || 0), 0);
              return (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center">
                    <Users size={20} className="text-[var(--color-cozy-olive)] mb-1" />
                    <span className="font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{customers.length}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Klanten</span>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center">
                    <TrendingUp size={20} className="text-[var(--color-cozy-olive)] mb-1" />
                    <span className="font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{totalConsAll}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Consumpties</span>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center">
                    <Calendar size={20} className="text-[var(--color-cozy-olive)] mb-1" />
                    <span className="font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{activeThisMonth}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Actief deze maand</span>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center">
                    <Award size={20} className="text-[var(--color-cozy-olive)] mb-1" />
                    <span className="font-mono text-2xl font-bold text-[var(--color-cozy-text)]">€{totalRevenueAll.toFixed(0)}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Geschatte omzet</span>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center">
                    <Gift size={20} className="text-[var(--color-cozy-olive)] mb-1" />
                    <span className="font-mono text-2xl font-bold text-[var(--color-cozy-text)]">€{totalGivenAwayAll.toFixed(0)}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Loyaliteitskorting</span>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {LOYALTY_TIER_ORDER.map((tier) => {
                const config = LOYALTY_TIER_CONFIG[tier];
                const count = customers.filter((customer) => customer.loyaltyTier === tier).length;
                return (
                  <div key={tier} className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      {loyaltyBadge(tier)}
                      <span className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{count}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug">
                      vanaf {config.minPoints} punten
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => setLoyaltyFilter('all')}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium border transition-colors',
                  loyaltyFilter === 'all'
                    ? 'bg-[var(--color-cozy-text)] text-white border-[var(--color-cozy-text)]'
                    : 'bg-white text-[var(--color-cozy-text)] border-gray-200 hover:bg-gray-50'
                )}
              >
                Alle levels
              </button>
              {LOYALTY_TIER_ORDER.map((tier) => {
                const config = LOYALTY_TIER_CONFIG[tier];
                const count = customers.filter((customer) => customer.loyaltyTier === tier).length;
                const isActive = loyaltyFilter === tier;

                return (
                  <button
                    key={`filter-${tier}`}
                    onClick={() => setLoyaltyFilter(tier)}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm font-medium border transition-colors',
                      isActive
                        ? `${config.adminBadgeClassName} shadow-sm`
                        : 'bg-white text-[var(--color-cozy-text)] border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {config.label} ({count})
                  </button>
                );
              })}
            </div>
            
            {/* Search bar */}
            <div className="relative mb-2">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Zoek op naam of e-mailadres..."
                className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-10 py-3 text-sm text-[var(--color-cozy-text)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-cozy-olive)] shadow-sm transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-3 flex items-center px-1 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Customer list */}
            {(() => {
              const q = searchQuery.trim().toLowerCase();
              const tierFiltered = loyaltyFilter === 'all'
                ? sortedCustomers
                : sortedCustomers.filter((customer) => customer.loyaltyTier === loyaltyFilter);
              const filtered = q
                ? tierFiltered.filter(c =>
                    c.name.toLowerCase().includes(q) ||
                    (c.email || '').toLowerCase().includes(q)
                  )
                : tierFiltered;
              if (filtered.length === 0) return (
                <p className="text-center text-gray-400 text-sm py-10">
                  Geen klanten gevonden{searchQuery ? ` voor "${searchQuery}"` : ''}{loyaltyFilter !== 'all' ? ` binnen ${LOYALTY_TIER_CONFIG[loyaltyFilter].label}` : ''}
                </p>
              );
              return filtered.map(customer => {
              const isExpanded = expandedCustomer === customer.id;
              const stats = calcCustomerStats(customer, Date.now());
              return (
                <div key={customer.id} className="bg-white rounded-[24px] shadow-sm overflow-hidden">
                  {/* Header row — always visible, tap to expand */}
                  <button
                    onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)}
                    className="w-full p-4 md:p-5 text-left active:bg-gray-50 transition-colors"
                  >
                    {/* Top: avatar + name + chevron (always one row) */}
                    <div className="flex items-center gap-3 md:gap-5">
                      <div className="w-11 h-11 md:w-14 md:h-14 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-serif font-bold text-xl md:text-2xl flex-shrink-0">
                        {customer.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif font-semibold text-base md:text-lg leading-tight truncate">{customer.name}</h3>
                          {loyaltyBadge(stats.loyaltyTier)}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{customer.email}</p>
                        <p className="text-[11px] text-[var(--color-cozy-text)]/65 mt-1">
                          {stats.loyaltyPoints} punten
                          {stats.loyaltyProgress.nextTier ? ` • nog ${stats.loyaltyProgress.pointsNeeded} tot ${LOYALTY_TIER_CONFIG[stats.loyaltyProgress.nextTier].label}` : ' • hoogste level bereikt'}
                        </p>
                      </div>
                      {/* Desktop: stamp counters inline */}
                      <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                        <div className="flex flex-col items-center bg-[#e8dcc8]/30 rounded-2xl px-4 py-2 min-w-[72px]">
                          <Coffee size={18} className="text-[var(--color-cozy-coffee)] mb-0.5" />
                          <span className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{customer.cards.coffee}<span className="text-xs font-normal text-gray-400">/10</span></span>
                        </div>
                        <div className="flex flex-col items-center bg-[#f0d8dc]/30 rounded-2xl px-4 py-2 min-w-[72px]">
                          <Wine size={18} className="text-[var(--color-cozy-wine)] mb-0.5" />
                          <span className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{customer.cards.wine}<span className="text-xs font-normal text-gray-400">/10</span></span>
                        </div>
                        <div className="flex flex-col items-center bg-[#fcf4d9]/30 rounded-2xl px-4 py-2 min-w-[72px]">
                          <Beer size={18} className="text-[var(--color-cozy-beer)] mb-0.5" />
                          <span className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{customer.cards.beer}<span className="text-xs font-normal text-gray-400">/10</span></span>
                        </div>
                        <div className="flex flex-col items-center bg-[#fce4f0]/30 rounded-2xl px-4 py-2 min-w-[72px]">
                          <GlassWater size={18} className="text-[var(--color-cozy-soda)] mb-0.5" />
                          <span className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{customer.cards.soda}<span className="text-xs font-normal text-gray-400">/10</span></span>
                        </div>
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex-shrink-0 text-gray-400 ml-1"
                      >
                        <ChevronDown size={18} />
                      </motion.div>
                    </div>
                    {/* Mobile: stamp counters below name */}
                    <div className="flex md:hidden items-center gap-2 mt-3 ml-14">
                      <div className="flex-1 flex flex-col items-center bg-[#e8dcc8]/30 rounded-xl py-1.5">
                        <Coffee size={14} className="text-[var(--color-cozy-coffee)] mb-0.5" />
                        <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{customer.cards.coffee}<span className="text-[10px] font-normal text-gray-400">/10</span></span>
                      </div>
                      <div className="flex-1 flex flex-col items-center bg-[#f0d8dc]/30 rounded-xl py-1.5">
                        <Wine size={14} className="text-[var(--color-cozy-wine)] mb-0.5" />
                        <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{customer.cards.wine}<span className="text-[10px] font-normal text-gray-400">/10</span></span>
                      </div>
                      <div className="flex-1 flex flex-col items-center bg-[#fcf4d9]/30 rounded-xl py-1.5">
                        <Beer size={14} className="text-[var(--color-cozy-beer)] mb-0.5" />
                        <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{customer.cards.beer}<span className="text-[10px] font-normal text-gray-400">/10</span></span>
                      </div>
                      <div className="flex-1 flex flex-col items-center bg-[#fce4f0]/30 rounded-xl py-1.5">
                        <GlassWater size={14} className="text-[var(--color-cozy-soda)] mb-0.5" />
                        <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{customer.cards.soda}<span className="text-[10px] font-normal text-gray-400">/10</span></span>
                      </div>
                    </div>
                  </button>

                  {/* Collapsible detail */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="detail"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 border-t border-gray-50">
                          {/* Email */}
                          <div className="flex items-center gap-2 mt-4 mb-4 bg-gray-50 rounded-xl px-4 py-3">
                            <Mail size={16} className="text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-600 break-all">{customer.email || 'Geen e-mail beschikbaar'}</span>
                          </div>

                          {/* ── Klant Intelligence ──────────────────── */}
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Klant Inzichten</p>
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-[var(--color-cozy-olive)]/5 rounded-xl p-3 flex flex-col items-center border border-[var(--color-cozy-olive)]/10">
                              <Award size={16} className="text-[var(--color-cozy-olive)] mb-1" />
                              {loyaltyBadge(stats.loyaltyTier)}
                              <span className="text-[10px] text-gray-400 mt-1">level</span>
                            </div>
                            <div className="bg-[var(--color-cozy-olive)]/5 rounded-xl p-3 flex flex-col items-center border border-[var(--color-cozy-olive)]/10">
                              <TrendingUp size={16} className="text-[var(--color-cozy-olive)] mb-1" />
                              <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{stats.loyaltyPoints}</span>
                              <span className="text-[10px] text-gray-400">punten</span>
                            </div>
                            <div className="bg-[var(--color-cozy-olive)]/5 rounded-xl p-3 flex flex-col items-center border border-[var(--color-cozy-olive)]/10">
                              <Star size={16} className="text-[var(--color-cozy-olive)] mb-1" />
                              <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{stats.hasFavorite ? cardTypeLabels[stats.favorite] : '—'}</span>
                              <span className="text-[10px] text-gray-400">favoriet</span>
                            </div>
                            <div className="bg-[var(--color-cozy-olive)]/5 rounded-xl p-3 flex flex-col items-center border border-[var(--color-cozy-olive)]/10">
                              <Award size={16} className="text-[var(--color-cozy-olive)] mb-1" />
                              <span className="font-mono text-center text-sm font-bold text-[var(--color-cozy-text)]">
                                {stats.loyaltyProgress.nextTier ? `Nog ${stats.loyaltyProgress.pointsNeeded}` : 'Max'}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {stats.loyaltyProgress.nextTier ? `tot ${LOYALTY_TIER_CONFIG[stats.loyaltyProgress.nextTier].label}` : 'VIP-status'}
                              </span>
                            </div>
                            <div className="bg-[var(--color-cozy-olive)]/5 rounded-xl p-3 flex flex-col items-center border border-[var(--color-cozy-olive)]/10">
                              <TrendingUp size={16} className="text-[var(--color-cozy-olive)] mb-1" />
                              <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">€{stats.estimatedRevenue.toFixed(0)}</span>
                              <span className="text-[10px] text-gray-400">geschatte omzet</span>
                            </div>
                            <div className="bg-[var(--color-cozy-olive)]/5 rounded-xl p-3 flex flex-col items-center border border-[var(--color-cozy-olive)]/10">
                              <Gift size={16} className="text-[var(--color-cozy-olive)] mb-1" />
                              <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">€{stats.estimatedGivenAway.toFixed(0)}</span>
                              <span className="text-[10px] text-gray-400">loyaliteitskorting</span>
                            </div>
                            <div className="bg-[var(--color-cozy-olive)]/5 rounded-xl p-3 flex flex-col items-center border border-[var(--color-cozy-olive)]/10">
                              <Calendar size={16} className="text-[var(--color-cozy-olive)] mb-1" />
                              <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{customer.totalVisits || 0}</span>
                              <span className="text-[10px] text-gray-400">bezoeken</span>
                            </div>
                            <div className="bg-[var(--color-cozy-olive)]/5 rounded-xl p-3 flex flex-col items-center border border-[var(--color-cozy-olive)]/10">
                              <Calendar size={16} className="text-[var(--color-cozy-olive)] mb-1" />
                              <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">
                                {stats.daysSinceLastVisit !== null 
                                  ? stats.daysSinceLastVisit === 0 ? 'Vandaag' : `${stats.daysSinceLastVisit}d geleden`
                                  : '—'}
                              </span>
                              <span className="text-[10px] text-gray-400">laatste bezoek</span>
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 border border-gray-100">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <span className="text-xs text-gray-500">Voortgang binnen level</span>
                              <span className="text-xs font-medium text-[var(--color-cozy-text)]">
                                {stats.loyaltyProgress.nextTier ? `${stats.loyaltyProgress.progressPercent}% naar ${LOYALTY_TIER_CONFIG[stats.loyaltyProgress.nextTier].label}` : 'VIP bereikt'}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-white overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${stats.loyaltyProgress.progressPercent}%`,
                                  background: stats.loyaltyProgress.nextTier
                                    ? `linear-gradient(90deg, ${LOYALTY_TIER_CONFIG[stats.loyaltyTier].accentColor}, ${LOYALTY_TIER_CONFIG[stats.loyaltyProgress.nextTier].accentColor})`
                                    : LOYALTY_TIER_CONFIG[stats.loyaltyTier].accentColor,
                                }}
                              />
                            </div>
                          </div>

                          {/* Gem. per bezoek */}
                          {customer.totalVisits > 0 && (
                            <div className="bg-gray-50 rounded-xl px-4 py-2 mb-4 flex items-center justify-between">
                              <span className="text-xs text-gray-500">Gem. consumpties per bezoek</span>
                              <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{stats.avgPerVisit.toFixed(1)}</span>
                            </div>
                          )}

                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Totale consumpties ({stats.grandTotal})</p>
                          <div className="grid grid-cols-4 gap-2 mb-1">
                            <div className="bg-[#e8dcc8]/40 rounded-xl p-3 flex flex-col items-center">
                              <Coffee size={16} className="text-[var(--color-cozy-coffee)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.total.coffee}</span>
                              <span className="text-[10px] text-gray-400">totaal</span>
                            </div>
                            <div className="bg-[#f0d8dc]/40 rounded-xl p-3 flex flex-col items-center">
                              <Wine size={16} className="text-[var(--color-cozy-wine)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.total.wine}</span>
                              <span className="text-[10px] text-gray-400">totaal</span>
                            </div>
                            <div className="bg-[#fcf4d9]/40 rounded-xl p-3 flex flex-col items-center">
                              <Beer size={16} className="text-[var(--color-cozy-beer)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.total.beer}</span>
                              <span className="text-[10px] text-gray-400">totaal</span>
                            </div>
                            <div className="bg-[#fce4f0]/40 rounded-xl p-3 flex flex-col items-center">
                              <GlassWater size={16} className="text-[var(--color-cozy-soda)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.total.soda}</span>
                              <span className="text-[10px] text-gray-400">totaal</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 mb-1">
                            <div className="bg-[#e8dcc8]/20 rounded-xl p-3 flex flex-col items-center">
                              <Coffee size={14} className="text-[var(--color-cozy-coffee)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.avgPerMonth.coffee.toFixed(1)}</span>
                              <span className="text-[10px] text-gray-400">/maand</span>
                            </div>
                            <div className="bg-[#f0d8dc]/20 rounded-xl p-3 flex flex-col items-center">
                              <Wine size={14} className="text-[var(--color-cozy-wine)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.avgPerMonth.wine.toFixed(1)}</span>
                              <span className="text-[10px] text-gray-400">/maand</span>
                            </div>
                            <div className="bg-[#fcf4d9]/20 rounded-xl p-3 flex flex-col items-center">
                              <Beer size={14} className="text-[var(--color-cozy-beer)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.avgPerMonth.beer.toFixed(1)}</span>
                              <span className="text-[10px] text-gray-400">/maand</span>
                            </div>
                            <div className="bg-[#fce4f0]/20 rounded-xl p-3 flex flex-col items-center">
                              <GlassWater size={14} className="text-[var(--color-cozy-soda)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.avgPerMonth.soda.toFixed(1)}</span>
                              <span className="text-[10px] text-gray-400">/maand</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-300 text-right mb-4">
                            klant sinds {new Date(customer.createdAt).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })} ({stats.monthsActive < 2 ? '< 1 maand' : `${Math.floor(stats.monthsActive)} maanden`})
                          </p>

                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Stempelkaart</p>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-[#e8dcc8]/30 rounded-xl p-3 flex flex-col items-center">
                              <Coffee size={20} className="text-[var(--color-cozy-coffee)] mb-1" />
                              <span className="font-mono text-sm font-medium">{customer.cards.coffee}/10</span>
                            </div>
                            <div className="bg-[#f0d8dc]/30 rounded-xl p-3 flex flex-col items-center">
                              <Wine size={20} className="text-[var(--color-cozy-wine)] mb-1" />
                              <span className="font-mono text-sm font-medium">{customer.cards.wine}/10</span>
                            </div>
                            <div className="bg-[#fcf4d9]/30 rounded-xl p-3 flex flex-col items-center">
                              <Beer size={20} className="text-[var(--color-cozy-beer)] mb-1" />
                              <span className="font-mono text-sm font-medium">{customer.cards.beer}/10</span>
                            </div>
                            <div className="bg-[#fce4f0]/30 rounded-xl p-3 flex flex-col items-center">
                              <GlassWater size={20} className="text-[var(--color-cozy-soda)] mb-1" />
                              <span className="font-mono text-sm font-medium">{customer.cards.soda}/10</span>
                            </div>
                          </div>

                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-4">Volle kaarten (ongeclaimd)</p>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-[#e8dcc8]/20 rounded-xl p-3 flex flex-col items-center border border-[#e8dcc8]/50">
                              <Coffee size={16} className="text-[var(--color-cozy-coffee)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.rewards.coffee || 0}</span>
                              <span className="text-[10px] text-gray-400">te claimen</span>
                            </div>
                            <div className="bg-[#f0d8dc]/20 rounded-xl p-3 flex flex-col items-center border border-[#f0d8dc]/50">
                              <Wine size={16} className="text-[var(--color-cozy-wine)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.rewards.wine || 0}</span>
                              <span className="text-[10px] text-gray-400">te claimen</span>
                            </div>
                            <div className="bg-[#fcf4d9]/20 rounded-xl p-3 flex flex-col items-center border border-[#fcf4d9]/50">
                              <Beer size={16} className="text-[var(--color-cozy-beer)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.rewards.beer || 0}</span>
                              <span className="text-[10px] text-gray-400">te claimen</span>
                            </div>
                            <div className="bg-[#fce4f0]/20 rounded-xl p-3 flex flex-col items-center border border-[#fce4f0]/50">
                              <GlassWater size={16} className="text-[var(--color-cozy-soda)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.rewards.soda || 0}</span>
                              <span className="text-[10px] text-gray-400">te claimen</span>
                            </div>
                          </div>

                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-4">Ingewisseld</p>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-[#e8dcc8]/10 rounded-xl p-3 flex flex-col items-center border border-[#e8dcc8]/30">
                              <Coffee size={16} className="text-[var(--color-cozy-coffee)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.claimedRewards?.coffee || 0}</span>
                              <span className="text-[10px] text-gray-400">gratis</span>
                            </div>
                            <div className="bg-[#f0d8dc]/10 rounded-xl p-3 flex flex-col items-center border border-[#f0d8dc]/30">
                              <Wine size={16} className="text-[var(--color-cozy-wine)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.claimedRewards?.wine || 0}</span>
                              <span className="text-[10px] text-gray-400">gratis</span>
                            </div>
                            <div className="bg-[#fcf4d9]/10 rounded-xl p-3 flex flex-col items-center border border-[#fcf4d9]/30">
                              <Beer size={16} className="text-[var(--color-cozy-beer)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.claimedRewards?.beer || 0}</span>
                              <span className="text-[10px] text-gray-400">gratis</span>
                            </div>
                            <div className="bg-[#fce4f0]/10 rounded-xl p-3 flex flex-col items-center border border-[#fce4f0]/30">
                              <GlassWater size={16} className="text-[var(--color-cozy-soda)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.claimedRewards?.soda || 0}</span>
                              <span className="text-[10px] text-gray-400">gratis</span>
                            </div>
                          </div>

                          {/* Delete button */}
                          <div className="mt-6 pt-4 border-t border-gray-100">
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: customer.id, name: customer.name }); }}
                              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-red-500 bg-red-50 hover:bg-red-100 active:scale-[0.98] transition-all text-sm font-medium"
                            >
                              <Trash2 size={16} />
                              Account verwijderen
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
              }); // end filtered.map
            })()} 
          </motion.div>
        )}

        {view === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)] flex items-center gap-3">
                  <History size={28} className="text-[var(--color-cozy-olive)]" />
                  Historiek & correcties
                </h2>
                <p className="text-sm text-gray-500 mt-1 max-w-3xl">
                  Bekijk de laatste scans, inwisselingen en manuele correcties. Corrigeer fouten altijd met een reden en een medewerker in de audittrail.
                </p>
              </div>
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm min-w-[220px]">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Actieve medewerker</p>
                <p className="font-mono text-sm font-bold text-[var(--color-cozy-text)] break-all">{adminEmail ?? 'Onbekend'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.4fr] gap-4 items-start">
              <div className="bg-white rounded-[28px] shadow-sm p-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Manuele correctie</p>
                  <h3 className="text-xl font-display font-bold text-[var(--color-cozy-text)]">Nieuwe correctie registreren</h3>
                </div>

                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Klant</label>
                  <select
                    value={selectedCorrectionCustomerId}
                    onChange={(event) => setSelectedCorrectionCustomerId(event.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[var(--color-cozy-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-cozy-olive)]"
                  >
                    <option value="">Kies een klant…</option>
                    {sortedCustomers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.email ? `(${customer.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Reden</label>
                  <textarea
                    value={correctionReason}
                    onChange={(event) => setCorrectionReason(event.target.value)}
                    rows={3}
                    placeholder="bv. verkeerde scan gecompenseerd aan de toog"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[var(--color-cozy-text)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-cozy-olive)] resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Stempels huidige kaart</p>
                    <span className="text-[11px] text-gray-400">Moet tussen 0 en 9 uitkomen</span>
                  </div>
                  {(Object.keys(cardTypeLabels) as CardType[]).map((type) => (
                    <DeltaControl
                      key={`stamp-${type}`}
                      label={cardTypeLabels[type]}
                      value={correctionStamps[type]}
                      onChange={(value) => changeCorrectionRecord('stamps', type, value)}
                      accent="olive"
                    />
                  ))}
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Beschikbare beloningen</p>
                  {(Object.keys(cardTypeLabels) as CardType[]).map((type) => (
                    <DeltaControl
                      key={`reward-${type}`}
                      label={cardTypeLabels[type]}
                      value={correctionRewards[type]}
                      onChange={(value) => changeCorrectionRecord('rewards', type, value)}
                      accent="amber"
                    />
                  ))}
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Ingewisselde beloningen</p>
                  {(Object.keys(cardTypeLabels) as CardType[]).map((type) => (
                    <DeltaControl
                      key={`claimed-${type}`}
                      label={cardTypeLabels[type]}
                      value={correctionClaimed[type]}
                      onChange={(value) => changeCorrectionRecord('claimed', type, value)}
                      accent="rose"
                    />
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Bezoeken</p>
                  <DeltaControl
                    label="Totaal bezoeken"
                    value={correctionVisitDelta}
                    onChange={setCorrectionVisitDelta}
                    accent="blue"
                  />
                </div>

                {correctionError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {correctionError}
                  </div>
                )}
                {correctionSuccess && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {correctionSuccess}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={submitManualCorrection}
                    disabled={correctionSaving}
                    className="rounded-full bg-[var(--color-cozy-olive)] px-5 py-3 text-sm font-medium text-white hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save size={16} />
                    {correctionSaving ? 'Opslaan…' : 'Correctie opslaan'}
                  </button>
                  <button
                    onClick={() => {
                      setCorrectionError(null);
                      setCorrectionSuccess(null);
                      resetCorrectionForm();
                    }}
                    disabled={correctionSaving}
                    className="rounded-full bg-gray-100 px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-200 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    Formulier leegmaken
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-[28px] shadow-sm p-5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {([
                      { key: 'all', label: 'Alles', count: transactions.length },
                      { key: 'scan', label: 'Scans', count: transactions.filter(item => item.eventType === 'scan').length },
                      { key: 'redeem', label: 'Inwisselingen', count: transactions.filter(item => item.eventType === 'redeem').length },
                      { key: 'adjustment', label: 'Correcties', count: transactions.filter(item => item.eventType === 'adjustment').length },
                    ] as const).map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setHistoryFilter(item.key as 'all' | TransactionEventType)}
                        className={cn(
                          'rounded-2xl border px-4 py-3 text-left transition-all',
                          historyFilter === item.key
                            ? 'bg-[var(--color-cozy-olive)]/8 border-[var(--color-cozy-olive)]/20 text-[var(--color-cozy-text)]'
                            : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'
                        )}
                      >
                        <p className="text-[10px] uppercase tracking-wider">{item.label}</p>
                        <p className="font-mono text-2xl font-bold mt-1">{item.count}</p>
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(event) => setHistorySearch(event.target.value)}
                      placeholder="Zoek op klant, medewerker of reden..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[var(--color-cozy-text)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-cozy-olive)]"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {transactionsLoading && (
                    <div className="bg-white rounded-[28px] shadow-sm p-6 text-sm text-gray-400">Historiek laden…</div>
                  )}
                  {transactionsError && (
                    <div className="bg-red-50 border border-red-200 rounded-[28px] p-6 text-sm text-red-600">{transactionsError}</div>
                  )}
                  {!transactionsLoading && !transactionsError && filteredTransactions.length === 0 && (
                    <div className="bg-white rounded-[28px] shadow-sm p-6 text-sm text-gray-400">Geen transacties gevonden voor deze filter.</div>
                  )}

                  {!transactionsLoading && !transactionsError && filteredTransactions.map((transaction) => {
                    const summaryParts = buildTransactionSummaryParts(transaction);
                    const badgeClasses = transaction.eventType === 'scan'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : transaction.eventType === 'redeem'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200';

                    return (
                      <div key={transaction.id} className="bg-white rounded-[28px] shadow-sm p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider', badgeClasses)}>
                                {getTransactionLabel(transaction.eventType)}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(transaction.createdAt).toLocaleString('nl-BE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <h3 className="text-lg font-display font-bold text-[var(--color-cozy-text)] mt-2">{transaction.customerName}</h3>
                            <p className="text-sm text-gray-400">{transaction.customerEmail || 'Geen e-mail'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400">Medewerker</p>
                            <p className="font-mono text-sm font-bold text-[var(--color-cozy-text)] break-all max-w-[200px]">
                              {transaction.staffEmail ?? 'Onbekend'}
                            </p>
                          </div>
                        </div>

                        {summaryParts.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {summaryParts.map((part) => (
                              <span key={part} className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                                {part}
                              </span>
                            ))}
                          </div>
                        )}

                        {transaction.reason && (
                          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                            <span className="text-gray-400">Reden:</span> {transaction.reason}
                          </div>
                        )}

                        {transaction.txId && (
                          <p className="text-[11px] text-gray-400">QR transactie-ID: {transaction.txId}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'redeem' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {!qrPayload ? (
              <div className="space-y-6">
                <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)] mb-4">
                  Inwisselen
                </h2>
                <p className="text-gray-500 -mt-2 mb-4">
                  Selecteer het drankje dat de klant gratis krijgt:
                </p>

                <div className="space-y-3">
                  {(['coffee', 'wine', 'beer', 'soda'] as CardType[]).map((type, index) => {
                    const icons: Record<CardType, React.ElementType> = { coffee: Coffee, wine: Wine, beer: Beer, soda: GlassWater };
                    const colors: Record<CardType, string> = { coffee: 'bg-[#e8dcc8]', wine: 'bg-[#f0d8dc]', beer: 'bg-[#fcf4d9]', soda: 'bg-[#fce4f0]' };
                    const textColors: Record<CardType, string> = { coffee: 'text-[var(--color-cozy-coffee)]', wine: 'text-[var(--color-cozy-wine)]', beer: 'text-[var(--color-cozy-beer)]', soda: 'text-[var(--color-cozy-soda)]' };
                    const Icon = icons[type];

                    return (
                      <button
                        key={type}
                        onClick={async () => {
                          customersSnapshotRef.current = JSON.stringify(customers);
                          const payload = {
                            type: 'redeem',
                            cardType: type,
                            staffEmail: adminEmail,
                            txId: Math.random().toString(36).substring(7),
                            timestamp: Date.now(),
                          };
                          setQrPayload(await signQrPayload(payload));
                        }}
                        className="w-full bg-white rounded-[24px] p-5 shadow-sm flex items-center gap-4 hover:bg-gray-50 active:scale-[0.98] transition-all overflow-hidden"
                      >
                        <motion.div
                          className={cn("w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0", colors[type])}
                          initial={{ x: 80, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <Icon size={28} className={textColors[type]} />
                        </motion.div>
                        <motion.span
                          className="font-display font-bold text-xl text-[var(--color-cozy-text)]"
                          initial={{ x: 60, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ duration: 0.55, delay: index * 0.08 + 0.07, ease: [0.22, 1, 0.36, 1] }}
                        >
                          Gratis {cardTypeLabels[type]}
                        </motion.span>
                      </button>
                    );
                  })}
                </div>

                {/* Watermark in whitespace */}
                <div className="flex justify-center pt-16 pb-4 pointer-events-none select-none">
                  <img src="/cozylogo.png" alt="" aria-hidden="true" className="w-48 h-48 object-contain opacity-10" />
                </div>
              </div>
            ) : qrScanned ? (
              <motion.div
                key="scanned-redeem"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="w-24 h-24 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle size={48} className="text-green-500" />
                </div>
                <h3 className="text-2xl font-serif font-semibold text-[var(--color-cozy-text)] mb-2">QR gescand!</h3>
                <p className="text-gray-500">Beloning ingewisseld — scherm sluit automatisch</p>
              </motion.div>
            ) : (
              <div className="relative flex flex-col items-center justify-center py-8">
                <img
                  src="/cozylogo.png"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 object-contain opacity-10"
                />
                <div className="relative bg-white p-8 rounded-[40px] shadow-xl mb-8">
                  <QRCodeSVG value={qrPayload} size={240} level="H" />
                </div>
                <h3 className="text-2xl font-serif font-semibold text-[var(--color-cozy-text)] mb-2">
                  Laat de klant scannen
                </h3>
                <p className="text-gray-500 text-center mb-8">
                  De klant scant deze code om de gratis consumptie in te wisselen
                </p>
                <button
                  onClick={reset}
                  className="bg-white text-[var(--color-cozy-text)] border border-gray-200 rounded-full py-3 px-8 shadow-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Nieuwe Transactie
                </button>
                <div className="flex justify-center pt-16 pb-4 pointer-events-none select-none">
                  <img src="/cozylogo.png" alt="" aria-hidden="true" className="w-48 h-48 object-contain opacity-10" />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
            onClick={() => !deleting && setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center justify-center w-14 h-14 bg-red-50 rounded-full mx-auto mb-4">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h3 className="text-xl font-serif font-semibold text-center text-[var(--color-cozy-text)] mb-2">
                Account verwijderen?
              </h3>
              <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
                <span className="font-semibold text-gray-700">{deleteConfirm.name}</span> wordt volledig verwijderd.
                Alle stempels, beloningen en het login-account gaan verloren. Dit kan niet ongedaan worden!
              </p>
              <div className="flex gap-3">
                <button
                  disabled={deleting}
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 px-4 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Annuleren
                </button>
                <button
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    const ok = await deleteCustomer(deleteConfirm.id);
                    setDeleting(false);
                    if (ok) {
                      setDeleteConfirm(null);
                      setExpandedCustomer(null);
                    }
                  }}
                  className="flex-1 py-3 px-4 rounded-2xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <span className="animate-pulse">Verwijderen...</span>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Verwijderen
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ConsumptionRowProps {
  type: CardType;
  title: string;
  icon: React.ElementType;
  count: number;
  onInc: () => void;
  onDec: () => void;
  color: string;
  bg: string;
  index: number; // for staggered slide-in delay
}

interface DeltaControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  accent: 'olive' | 'amber' | 'rose' | 'blue';
}

const deltaAccentClass: Record<DeltaControlProps['accent'], string> = {
  olive: 'bg-[var(--color-cozy-olive)]/8 text-[var(--color-cozy-text)]',
  amber: 'bg-amber-50 text-amber-800',
  rose: 'bg-rose-50 text-rose-800',
  blue: 'bg-blue-50 text-blue-800',
};

const DeltaControl: React.FC<DeltaControlProps> = ({ label, value, onChange, accent }) => {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-[var(--color-cozy-text)]">{label}</p>
        <p className="text-[11px] text-gray-400">Negatief = terugdraaien, positief = toevoegen</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-transform"
        >
          <Minus size={16} />
        </button>
        <span className={cn('min-w-[68px] rounded-full px-3 py-1.5 text-center font-mono text-sm font-bold', deltaAccentClass[accent])}>
          {value > 0 ? `+${value}` : value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-transform"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

const ConsumptionRow: React.FC<ConsumptionRowProps> = ({ title, icon: Icon, count, onInc, onDec, color, bg, index }) => {
  const countControls = useAnimationControls();

  const handleInc = () => {
    onInc();
    // Cheerful little bounce up
    countControls.start({
      y: [0, -8, 3, -3, 0],
      scale: [1, 1.25, 1.1, 1.05, 1],
      transition: { duration: 0.38, ease: 'easeOut' },
    });
  };

  const handleDec = () => {
    if (count === 0) return;
    onDec();
    // Quick drop + shrink — feels like removal
    countControls.start({
      y: [0, 5, -2, 0],
      scale: [1, 0.75, 0.95, 1],
      opacity: [1, 0.4, 0.8, 1],
      transition: { duration: 0.32, ease: 'easeInOut' },
    });
  };

  return (
    <div className="bg-white rounded-[24px] p-4 shadow-sm flex items-center justify-between overflow-hidden">
      <div className="flex items-center gap-4">
        {/* Icon — slides in from right with stagger */}
        <motion.div
          className={cn('w-12 h-12 rounded-full flex items-center justify-center', bg, color)}
          initial={{ x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <Icon size={24} />
        </motion.div>

        {/* Title — slides in from right slightly after icon */}
        <motion.span
          className="font-display font-bold text-xl"
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.55, delay: index * 0.08 + 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
          {title}
        </motion.span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleDec}
          disabled={count === 0}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-50 active:scale-90 transition-transform"
        >
          <Minus size={20} />
        </button>

        {/* Animated count */}
        <motion.span
          animate={countControls}
          className="font-mono text-xl font-medium w-6 text-center inline-block"
        >
          {count}
        </motion.span>

        <button
          onClick={handleInc}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:scale-90 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};
