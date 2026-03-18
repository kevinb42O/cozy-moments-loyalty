import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Coffee, Wine, Beer, GlassWater, Plus, Minus, QrCode, LogOut, ChevronDown, CheckCircle, Download, Mail, Star, TrendingUp, Users, Calendar, Award, Trash2, AlertTriangle, Megaphone, X, Gift, Clock3, History, Save, Settings2, ArrowLeft, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { useBusinessAuth } from '../store/BusinessAuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { useLoyalty, CardType, cardTypeLabels } from '../../shared/store/LoyaltyContext';
import { Screensaver } from '../components/Screensaver';
import { ScreensaverEditor } from '../components/ScreensaverEditor';
import { DrinkMenuEditor } from '../components/DrinkMenuEditor';
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
import {
  MAX_SLIDE_DURATION_MS,
  MAX_SCREENAVER_UPLOAD_FILE_SIZE_BYTES,
  MAX_SCREENSAVER_UPLOAD_LONG_SIDE_PX,
  MAX_SCREENSAVER_UPLOAD_TOTAL_PIXELS,
  MIN_SLIDE_DURATION_MS,
  MIN_SCREENSAVER_UPLOAD_SHORT_SIDE_PX,
  SCREENSAVER_STORAGE_BUCKET,
  getScreensaverStoragePath,
  normalizeScreensaverConfig,
  reorderScreensaverSlides,
  resetScreensaverSlidesToDefaults,
  serializeScreensaverConfig,
  type ScreensaverImageRole,
  type ScreensaverSlideConfig,
} from '../../shared/lib/screensaver-config';
import {
  loadCachedScreensaverSlides,
  persistCachedScreensaverSlides,
  warmScreensaverImageCache,
} from '../../shared/lib/screensaver-cache';
import {
  createDefaultDrinkMenuSections,
  createEmptyDrinkMenuItem,
  createEmptyDrinkMenuSection,
  getAutomaticPromoDrinkMenuItemIds,
  getMultiPromoDrinkMenuItemIds,
  normalizeActivePromos,
  normalizeDrinkMenuSections,
  serializeActivePromos,
  serializeDrinkMenuSections,
  MAX_ACTIVE_PROMOS,
  type ActivePromo,
  type DrinkMenuItem,
  type DrinkMenuSection,
} from '../../shared/lib/drink-menu';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const HIDDEN_ADMIN_VIEWS: Array<{ view: Extract<BusinessView, 'customers' | 'open-bottles' | 'history' | 'screensaver' | 'drink-menu'>; label: string }> = [
  { view: 'customers', label: 'Klanten' },
  { view: 'open-bottles', label: 'Open flessen' },
  { view: 'history', label: 'Historiek' },
  { view: 'drink-menu', label: 'Drankkaart' },
  { view: 'screensaver', label: 'Screensaver' },
];

// ── Admin audio chime (same Web Audio approach as Scanner) ────────────────────
let adminAudioCtx: AudioContext | null = null;

function getAdminAudioContextConstructor() {
  const browserGlobal = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  return browserGlobal.AudioContext ?? browserGlobal.webkitAudioContext ?? null;
}

function ensureAdminAudioContext() {
  if (!adminAudioCtx || adminAudioCtx.state === 'closed') {
    const AudioContextConstructor = getAdminAudioContextConstructor();
    if (!AudioContextConstructor) {
      return null;
    }
    adminAudioCtx = new AudioContextConstructor();
  }

  return adminAudioCtx;
}

function unlockAdminAudio() {
  try {
    const audioContext = ensureAdminAudioContext();
    if (audioContext?.state === 'suspended') void audioContext.resume();
  } catch { /* ignore */ }
}

async function playAdminChime() {
  try {
    const ctx = ensureAdminAudioContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === 'suspended') await ctx.resume();
    const notes = [
      { freq: 660,  start: 0,    duration: 0.18 },
      { freq: 880,  start: 0.15, duration: 0.18 },
      { freq: 1100, start: 0.3, duration: 0.3 },
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
  coffee: 3,
  wine: 5,
  beer: 4,
  soda: 3,
};

type BusinessView = 'create' | 'open-bottles' | 'customers' | 'history' | 'screensaver' | 'drink-menu' | 'redeem';
type OpenBottleRisk = 'red' | 'orange';
type OpenBottleFilter = 'all' | 'open' | 'expired' | 'promo';
type HistoryPanelKey = 'correction' | 'filters';

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
  const prefix = 'Nog';
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

async function compressScreensaverImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Gebruik alleen JPG, PNG of WebP voor screensaverbeelden.');
  }

  if (file.size > MAX_SCREENAVER_UPLOAD_FILE_SIZE_BYTES) {
    throw new Error(`Het bronbestand is te zwaar. Gebruik maximaal ${Math.round(MAX_SCREENAVER_UPLOAD_FILE_SIZE_BYTES / (1024 * 1024))} MB.`);
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('De afbeelding kon niet worden ingelezen.'));
      element.src = objectUrl;
    });

    const shortSide = Math.min(image.naturalWidth, image.naturalHeight);
    const longSide = Math.max(image.naturalWidth, image.naturalHeight);
    const totalPixels = image.naturalWidth * image.naturalHeight;

    if (shortSide < MIN_SCREENSAVER_UPLOAD_SHORT_SIDE_PX) {
      throw new Error(`De afbeelding is te klein. De kortste zijde moet minstens ${MIN_SCREENSAVER_UPLOAD_SHORT_SIDE_PX}px zijn.`);
    }

    if (longSide > MAX_SCREENSAVER_UPLOAD_LONG_SIDE_PX) {
      throw new Error(`De afbeelding is te groot. De langste zijde mag maximaal ${MAX_SCREENSAVER_UPLOAD_LONG_SIDE_PX}px zijn.`);
    }

    if (totalPixels > MAX_SCREENSAVER_UPLOAD_TOTAL_PIXELS) {
      throw new Error(`De afbeelding bevat te veel pixels. Gebruik maximaal ${Math.round(MAX_SCREENSAVER_UPLOAD_TOTAL_PIXELS / 1_000_000)} megapixel.`);
    }

    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is niet beschikbaar in deze browser.');
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('De afbeelding kon niet worden gecomprimeerd.'));
          return;
        }
        resolve(blob);
      }, 'image/webp', 0.82);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function calcCustomerStats(customer: import('../../shared/store/LoyaltyContext').Customer, nowMs: number) {
  const createdMs = new Date(customer.createdAt).getTime();
  const monthsActive = Math.max(1, (nowMs - createdMs) / MS_PER_MONTH);
  const total: Record<CardType, number> = {
    coffee: (customer.claimedRewards.coffee + customer.rewards.coffee) * 12 + customer.cards.coffee,
    wine:   (customer.claimedRewards.wine   + customer.rewards.wine  ) * 12 + customer.cards.wine,
    beer:   (customer.claimedRewards.beer   + customer.rewards.beer  ) * 12 + customer.cards.beer,
    soda:   (customer.claimedRewards.soda   + customer.rewards.soda  ) * 12 + customer.cards.soda,
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
  const favorite = types.reduce((a, b) => total[a] >= total[b] ? a : b, types[0]);
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
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return globalThis.localStorage.getItem('cozy-admin-dark-mode') === '1';
    } catch {
      return false;
    }
  });
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loyaltyFilter, setLoyaltyFilter] = useState<'all' | LoyaltyTier>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Promo state — up to MAX_ACTIVE_PROMOS simultaneously
  const [activePromos, setActivePromos] = useState<ActivePromo[]>([]);
  const [promoSaving, setPromoSaving] = useState(false);
  const [openBottles, setOpenBottles] = useState<Record<string, OpenBottleEntry>>({});
  const [openBottleFilter, setOpenBottleFilter] = useState<OpenBottleFilter>('all');
  const [collapsedInactiveBottleGroups, setCollapsedInactiveBottleGroups] = useState<Record<OpenBottleRisk, boolean>>({
    red: true,
    orange: true,
  });
  const [screensaverSlides, setScreensaverSlides] = useState<ScreensaverSlideConfig[]>(() => loadCachedScreensaverSlides());
  const [screensaverDraft, setScreensaverDraft] = useState<ScreensaverSlideConfig[]>(() => loadCachedScreensaverSlides());
  const [screensaverEditing, setScreensaverEditing] = useState(false);
  const [screensaverSaving, setScreensaverSaving] = useState(false);
  const [screensaverUploadingTarget, setScreensaverUploadingTarget] = useState<string | null>(null);
  const [screensaverError, setScreensaverError] = useState<string | null>(null);
  const [screensaverSuccess, setScreensaverSuccess] = useState<string | null>(null);
  const [screensaverPreviewSlides, setScreensaverPreviewSlides] = useState<ScreensaverSlideConfig[] | null>(null);
  const [screensaverPreviewRequest, setScreensaverPreviewRequest] = useState(0);
  const [drinkMenuSections, setDrinkMenuSections] = useState<DrinkMenuSection[]>(() => createDefaultDrinkMenuSections());
  const [drinkMenuDraft, setDrinkMenuDraft] = useState<DrinkMenuSection[]>(() => createDefaultDrinkMenuSections());
  const [drinkMenuEditing, setDrinkMenuEditing] = useState(false);
  const [drinkMenuSaving, setDrinkMenuSaving] = useState(false);
  const [drinkMenuError, setDrinkMenuError] = useState<string | null>(null);
  const [drinkMenuSuccess, setDrinkMenuSuccess] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | TransactionEventType>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPanelsOpen, setHistoryPanelsOpen] = useState<Record<HistoryPanelKey, boolean>>({
    correction: false,
    filters: true,
  });
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<Record<string, boolean>>({
    today: false,
    yesterday: false,
    thisWeek: true,
    earlier: true,
  });
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
  const adminMenuRef = useRef<HTMLDivElement | null>(null);

  // Unlock AudioContext on first tap (needed on iOS/Android)
  useEffect(() => {
    const handler = () => unlockAdminAudio();
    globalThis.addEventListener('touchstart', handler, { once: true, passive: true });
    globalThis.addEventListener('click', handler, { once: true, passive: true });
    return () => {
      globalThis.removeEventListener('touchstart', handler);
      globalThis.removeEventListener('click', handler);
    };
  }, []);

  // Always fetch fresh data when the customers tab is opened
  useEffect(() => {
    if (view === 'customers' || view === 'history') refreshCustomers();
  }, [view]);

  useEffect(() => {
    const interval = globalThis.setInterval(() => setClockNow(Date.now()), 30000);
    return () => globalThis.clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      globalThis.localStorage.setItem('cozy-admin-dark-mode', isDarkMode ? '1' : '0');
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!showAdminMenu) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (adminMenuRef.current?.contains(target)) return;
      setShowAdminMenu(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAdminMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAdminMenu]);

  const screensaverDirty = useMemo(
    () => JSON.stringify(serializeScreensaverConfig(screensaverDraft)) !== JSON.stringify(serializeScreensaverConfig(screensaverSlides)),
    [screensaverDraft, screensaverSlides]
  );

  const drinkMenuDirty = useMemo(
    () => JSON.stringify(serializeDrinkMenuSections(drinkMenuDraft)) !== JSON.stringify(serializeDrinkMenuSections(drinkMenuSections)),
    [drinkMenuDraft, drinkMenuSections]
  );

  useEffect(() => {
    persistCachedScreensaverSlides(screensaverSlides);
    void warmScreensaverImageCache(screensaverSlides);
  }, [screensaverSlides]);

  const loadSiteSettings = useCallback(async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('site_settings')
      .select('promo_message, open_bottles, screensaver_config, drink_menu_sections, active_promos')
      .eq('id', 'default')
      .single();

    if (error) {
      console.error('Kon site_settings niet laden:', error);
      return;
    }

    const nextActivePromos = normalizeActivePromos((data as { active_promos?: unknown } | null)?.active_promos);
    setActivePromos(nextActivePromos);
    setOpenBottles(normalizeOpenBottleState((data as { open_bottles?: unknown } | null)?.open_bottles));
    const nextScreensaverSlides = normalizeScreensaverConfig((data as { screensaver_config?: unknown } | null)?.screensaver_config);
    setScreensaverSlides(nextScreensaverSlides);
    setScreensaverDraft(current => screensaverEditing ? current : nextScreensaverSlides);
    persistCachedScreensaverSlides(nextScreensaverSlides);
    void warmScreensaverImageCache(nextScreensaverSlides);
    const nextDrinkMenuSections = normalizeDrinkMenuSections(
      (data as { drink_menu_sections?: unknown } | null)?.drink_menu_sections,
      createDefaultDrinkMenuSections()
    );
    setDrinkMenuSections(nextDrinkMenuSections);
    setDrinkMenuDraft(current => drinkMenuEditing ? current : nextDrinkMenuSections);
  }, [drinkMenuEditing, screensaverEditing]);

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
    nextActivePromos: ActivePromo[],
    nextOpenBottles: Record<string, OpenBottleEntry>,
    nextScreensaverSlides: ScreensaverSlideConfig[]
  ) => {
    setActivePromos(nextActivePromos);
    setOpenBottles(nextOpenBottles);
    setScreensaverSlides(nextScreensaverSlides);
    persistCachedScreensaverSlides(nextScreensaverSlides);
    void warmScreensaverImageCache(nextScreensaverSlides);

    // Backward compat: populate legacy single-promo columns from the first active promo
    const firstPromo = nextActivePromos[0] ?? null;
    const legacyPromoMessage = firstPromo?.promoMessage ?? '';
    const legacyPromoProductId = firstPromo?.productId ?? null;
    const legacyPromoDrinkMenuItemIds = getMultiPromoDrinkMenuItemIds(
      drinkMenuSections,
      nextActivePromos.map((p) => ({ productId: p.productId, productName: OPEN_BOTTLE_PRODUCT_MAP[p.productId]?.name ?? '' })),
    );

    if (!supabase) return true;

    const { error } = await supabase
      .from('site_settings')
      .update({
        promo_message: legacyPromoMessage,
        promo_open_bottle_product_id: legacyPromoProductId,
        promo_drink_menu_item_ids: legacyPromoDrinkMenuItemIds,
        active_promos: serializeActivePromos(nextActivePromos),
        open_bottles: nextOpenBottles,
        screensaver_config: serializeScreensaverConfig(nextScreensaverSlides),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default');

    if (error) {
      console.error('Kon site_settings niet opslaan:', error);
      return false;
    }

    return true;
  }, [drinkMenuSections]);

  const persistDrinkMenuSections = useCallback(async (nextSections: DrinkMenuSection[]) => {
    setDrinkMenuSections(nextSections);
    const nextPromoDrinkMenuItemIds = getMultiPromoDrinkMenuItemIds(
      nextSections,
      activePromos.map((p) => ({ productId: p.productId, productName: OPEN_BOTTLE_PRODUCT_MAP[p.productId]?.name ?? '' })),
    );

    if (!supabase) return true;

    const { error } = await supabase
      .from('site_settings')
      .update({
        drink_menu_sections: serializeDrinkMenuSections(nextSections),
        promo_drink_menu_item_ids: nextPromoDrinkMenuItemIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default');

    if (error) {
      console.error('Kon drink_menu_sections niet opslaan:', error);
      return false;
    }

    return true;
  }, [activePromos]);

  const clearAllPromos = async () => {
    setPromoSaving(true);
    await persistSiteSettings([], openBottles, screensaverSlides);
    setPromoSaving(false);
  };

  const updateScreensaverDraft = useCallback((updater: (current: ScreensaverSlideConfig[]) => ScreensaverSlideConfig[]) => {
    setScreensaverEditing(true);
    setScreensaverError(null);
    setScreensaverSuccess(null);
    setScreensaverDraft((current) => normalizeScreensaverConfig(updater(current)));
  }, []);

  const handleScreensaverMove = useCallback((slideId: string, direction: -1 | 1) => {
    updateScreensaverDraft((current) => reorderScreensaverSlides(current, slideId, direction));
  }, [updateScreensaverDraft]);

  const handleScreensaverSwapSides = useCallback((slideId: string) => {
    updateScreensaverDraft((current) => current.map((slide) => {
      if (slide.id !== slideId || slide.mode !== 'dual') return slide;
      return { ...slide, swapSides: !slide.swapSides };
    }));
  }, [updateScreensaverDraft]);

  const handleScreensaverDurationChange = useCallback((slideId: string, durationMs: number) => {
    const clampedDuration = Math.max(MIN_SLIDE_DURATION_MS, Math.min(MAX_SLIDE_DURATION_MS, durationMs));
    updateScreensaverDraft((current) => current.map((slide) => (
      slide.id === slideId
        ? { ...slide, durationMs: clampedDuration }
        : slide
    )));
  }, [updateScreensaverDraft]);

  const handleScreensaverResetImage = useCallback((slideId: string, role: ScreensaverImageRole) => {
    updateScreensaverDraft((current) => current.map((slide) => {
      if (slide.id !== slideId) return slide;
      return role === 'primary'
        ? { ...slide, customPrimaryImageUrl: null }
        : { ...slide, customSecondaryImageUrl: null };
    }));
  }, [updateScreensaverDraft]);

  const handleScreensaverResetAll = useCallback(() => {
    setScreensaverEditing(true);
    setScreensaverError(null);
    setScreensaverSuccess(null);
    setScreensaverDraft(resetScreensaverSlidesToDefaults());
  }, []);

  const handleScreensaverPreview = useCallback(() => {
    const previewSlides = normalizeScreensaverConfig(screensaverDraft);
    setScreensaverError(null);
    setScreensaverSuccess(null);
    setScreensaverPreviewSlides(previewSlides);
    void warmScreensaverImageCache(previewSlides);
    setScreensaverPreviewRequest((current) => current + 1);
  }, [screensaverDraft]);

  const handleScreensaverUpload = useCallback(async (slideId: string, role: ScreensaverImageRole, file: File) => {
    if (!supabase) {
      setScreensaverError('Supabase is niet geconfigureerd, dus uploads zijn nu niet beschikbaar.');
      return;
    }

    setScreensaverError(null);
    setScreensaverSuccess(null);
    setScreensaverUploadingTarget(`${slideId}:${role}`);

    try {
      const compressedImage = await compressScreensaverImage(file);
      const storagePath = getScreensaverStoragePath(slideId, role);
      const bucket = supabase.storage.from(SCREENSAVER_STORAGE_BUCKET);
      const { error } = await bucket.upload(storagePath, compressedImage, {
        upsert: true,
        contentType: 'image/webp',
        cacheControl: '3600',
      });

      if (error) {
        throw error;
      }

      const { data } = bucket.getPublicUrl(storagePath);
      const imageUrl = `${data.publicUrl}?v=${Date.now()}`;

      updateScreensaverDraft((current) => current.map((slide) => {
        if (slide.id !== slideId) return slide;
        return role === 'primary'
          ? { ...slide, customPrimaryImageUrl: imageUrl }
          : { ...slide, customSecondaryImageUrl: imageUrl };
      }));

      setScreensaverSuccess('Nieuwe afbeelding staat klaar. Gebruik eventueel eerst preview en klik daarna op opslaan om alles definitief vast te zetten.');
    } catch (error) {
      console.error('Kon screensaver-afbeelding niet uploaden:', error);
      setScreensaverError(error instanceof Error ? error.message : 'Upload mislukt.');
    } finally {
      setScreensaverUploadingTarget(null);
    }
  }, [updateScreensaverDraft]);

  const saveScreensaver = useCallback(async () => {
    const normalizedDraft = normalizeScreensaverConfig(screensaverDraft);
    setScreensaverSaving(true);
    const ok = await persistSiteSettings(activePromos, openBottles, normalizedDraft);
    setScreensaverSaving(false);

    if (!ok) {
      setScreensaverError('De screensaver kon niet worden opgeslagen.');
      return;
    }

    setScreensaverSlides(normalizedDraft);
    setScreensaverDraft(normalizedDraft);
    setScreensaverEditing(false);
    setScreensaverError(null);
    setScreensaverSuccess('Screensaver opgeslagen. De nieuwe volgorde en timing zijn meteen actief.');
  }, [openBottles, persistSiteSettings, activePromos, screensaverDraft]);

  const updateDrinkMenuDraft = useCallback((updater: (current: DrinkMenuSection[]) => DrinkMenuSection[]) => {
    setDrinkMenuEditing(true);
    setDrinkMenuError(null);
    setDrinkMenuSuccess(null);
    setDrinkMenuDraft((current) => normalizeDrinkMenuSections(updater(current), []));
  }, []);

  const handleDrinkMenuSectionUpdate = useCallback((sectionId: string, patch: Partial<Pick<DrinkMenuSection, 'sectionCode' | 'title' | 'isVisible'>>) => {
    updateDrinkMenuDraft((current) => current.map((section) => (
      section.id === sectionId ? { ...section, ...patch } : section
    )));
  }, [updateDrinkMenuDraft]);

  const handleDrinkMenuAddSection = useCallback(() => {
    updateDrinkMenuDraft((current) => [...current, createEmptyDrinkMenuSection()]);
  }, [updateDrinkMenuDraft]);

  const handleDrinkMenuRemoveSection = useCallback((sectionId: string) => {
    updateDrinkMenuDraft((current) => current.filter((section) => section.id !== sectionId));
  }, [updateDrinkMenuDraft]);

  const handleDrinkMenuMoveSection = useCallback((sectionId: string, direction: -1 | 1) => {
    updateDrinkMenuDraft((current) => {
      const index = current.findIndex((section) => section.id === sectionId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [section] = next.splice(index, 1);
      next.splice(nextIndex, 0, section);
      return next;
    });
  }, [updateDrinkMenuDraft]);

  const handleDrinkMenuAddItem = useCallback((sectionId: string) => {
    updateDrinkMenuDraft((current) => current.map((section) => (
      section.id === sectionId
        ? { ...section, items: [...section.items, createEmptyDrinkMenuItem()] }
        : section
    )));
  }, [updateDrinkMenuDraft]);

  const handleDrinkMenuItemUpdate = useCallback((sectionId: string, itemId: string, patch: Partial<Pick<DrinkMenuItem, 'name' | 'price' | 'details' | 'isVisible'>>) => {
    updateDrinkMenuDraft((current) => current.map((section) => {
      if (section.id !== sectionId) return section;

      return {
        ...section,
        items: section.items.map((item) => (
          item.id === itemId ? { ...item, ...patch } : item
        )),
      };
    }));
  }, [updateDrinkMenuDraft]);

  const handleDrinkMenuRemoveItem = useCallback((sectionId: string, itemId: string) => {
    updateDrinkMenuDraft((current) => current.map((section) => {
      if (section.id !== sectionId) return section;

      return {
        ...section,
        items: section.items.filter((item) => item.id !== itemId),
      };
    }));
  }, [updateDrinkMenuDraft]);

  const handleDrinkMenuMoveItem = useCallback((sectionId: string, itemId: string, direction: -1 | 1) => {
    updateDrinkMenuDraft((current) => current.map((section) => {
      if (section.id !== sectionId) return section;

      const index = section.items.findIndex((item) => item.id === itemId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= section.items.length) {
        return section;
      }

      const nextItems = [...section.items];
      const [item] = nextItems.splice(index, 1);
      nextItems.splice(nextIndex, 0, item);

      return {
        ...section,
        items: nextItems,
      };
    }));
  }, [updateDrinkMenuDraft]);

  const resetDrinkMenuDraft = useCallback(() => {
    setDrinkMenuDraft(drinkMenuSections);
    setDrinkMenuEditing(false);
    setDrinkMenuError(null);
    setDrinkMenuSuccess(null);
  }, [drinkMenuSections]);

  const saveDrinkMenu = useCallback(async () => {
    const normalizedDraft = normalizeDrinkMenuSections(drinkMenuDraft, []);
    setDrinkMenuSaving(true);
    const ok = await persistDrinkMenuSections(normalizedDraft);
    setDrinkMenuSaving(false);

    if (!ok) {
      setDrinkMenuError('De drankkaart kon niet worden opgeslagen.');
      return;
    }

    setDrinkMenuSections(normalizedDraft);
    setDrinkMenuDraft(normalizedDraft);
    setDrinkMenuEditing(false);
    setDrinkMenuError(null);
    setDrinkMenuSuccess('Drankkaart opgeslagen. De website kan nu deze gepubliceerde versie uitlezen.');
  }, [drinkMenuDraft, persistDrinkMenuSections]);

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
    await persistSiteSettings(activePromos, nextOpenBottles, screensaverSlides);
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

    // Remove from active promos if bottle is now empty
    const nextPromos = nextRemainingCount === 0
      ? activePromos.filter((p) => p.productId !== productId)
      : activePromos;

    await persistSiteSettings(nextPromos, nextOpenBottles, screensaverSlides);
  };

  const handleClearBottle = async (productId: string) => {
    const nextOpenBottles = { ...openBottles };
    delete nextOpenBottles[productId];

    // Remove from active promos
    const nextPromos = activePromos.filter((p) => p.productId !== productId);

    await persistSiteSettings(nextPromos, nextOpenBottles, screensaverSlides);
  };

  const handlePromoteBottle = async (product: OpenBottleProduct) => {
    if (!openBottles[product.id]) return;

    const alreadyInPromo = activePromos.some((p) => p.productId === product.id);
    let nextPromos: ActivePromo[];

    if (alreadyInPromo) {
      // Toggle off
      nextPromos = activePromos.filter((p) => p.productId !== product.id);
    } else {
      // Add (respecting max)
      const drinkMenuItemIds = getAutomaticPromoDrinkMenuItemIds(drinkMenuDraft, product.id, product.name);
      const newEntry: ActivePromo = {
        productId: product.id,
        promoMessage: product.promoMessage,
        drinkMenuItemIds,
      };
      nextPromos = [...activePromos, newEntry].slice(0, MAX_ACTIVE_PROMOS);
    }

    await persistSiteSettings(nextPromos, openBottles, screensaverSlides);
  };

  const activePromoProductIds = useMemo(() => new Set(activePromos.map((p) => p.productId)), [activePromos]);
  const activePromoDrinkMenuItemIds = useMemo(
    () => getMultiPromoDrinkMenuItemIds(
      drinkMenuDraft,
      activePromos.map((p) => ({ productId: p.productId, productName: OPEN_BOTTLE_PRODUCT_MAP[p.productId]?.name ?? '' })),
    ),
    [drinkMenuDraft, activePromos]
  );
  const activePromoProductNames = useMemo(
    () => activePromos.map((p) => OPEN_BOTTLE_PRODUCT_MAP[p.productId]?.name ?? p.productId),
    [activePromos]
  );
  const openBottleItems = OPEN_BOTTLE_PRODUCTS.map((product) => {
    const entry = openBottles[product.id];
    const openedAtMs = entry ? new Date(entry.openedAt).getTime() : null;
    const expiresAtMs = openedAtMs ? openedAtMs + product.expiryHours * 60 * 60 * 1000 : null;
    const remainingMs = expiresAtMs ? expiresAtMs - clockNow : null;
    const isExpired = remainingMs !== null && remainingMs <= 0;
    const isActive = Boolean(entry);
    const isPromoActive = activePromoProductIds.has(product.id);

    return {
      product,
      entry,
      openedAtMs,
      expiresAtMs,
      remainingMs,
      isExpired,
      isActive,
      isPromoActive,
      remainingLabel: entry
        ? formatRemainingCount(product, entry.remainingCount)
        : formatRemainingCount(product, product.maxRemainingCount),
      remainingCountValue: entry ? entry.remainingCount : product.maxRemainingCount,
      soldButtonLabel: 'Glas verkocht',
    };
  });
  const activeOpenBottleItems = openBottleItems
    .filter((item) => item.isActive)
    .sort((left, right) => {
      if (left.isExpired !== right.isExpired) return left.isExpired ? -1 : 1;
      if (left.isPromoActive !== right.isPromoActive) return left.isPromoActive ? -1 : 1;
      if (left.product.risk !== right.product.risk) return left.product.risk === 'red' ? -1 : 1;
      return left.product.name.localeCompare(right.product.name);
    });
  const inactiveOpenBottleItems = openBottleItems.filter((item) => !item.isActive);
  const expiredOpenBottleCount = activeOpenBottleItems.filter((item) => item.isExpired).length;
  const promoOpenBottleCount = activeOpenBottleItems.filter((item) => item.isPromoActive).length;
  const filteredActiveOpenBottleItems = activeOpenBottleItems.filter((item) => {
    if (openBottleFilter === 'all' || openBottleFilter === 'open') return true;
    if (openBottleFilter === 'expired') return item.isExpired;
    if (openBottleFilter === 'promo') return item.isPromoActive;
    return true;
  });
  const openBottleFilterMeta: Record<OpenBottleFilter, { title: string; note: string; empty: string }> = {
    all: {
      title: 'Nu open',
      note: 'De flessen die nu echt aandacht vragen, staan hier bovenaan.',
      empty: 'Er staat momenteel geen open fles actief. Open hieronder een nieuwe fles zodra iets wordt gestart.',
    },
    open: {
      title: 'Alle open flessen',
      note: 'Alle actieve flessen, ongeacht hun timerstatus.',
      empty: 'Er staat momenteel geen open fles actief.',
    },
    expired: {
      title: 'Alleen verlopen',
      note: 'Deze flessen zijn over hun venster en vragen eerst aandacht.',
      empty: 'Geen enkele open fles is momenteel over tijd.',
    },
    promo: {
      title: 'Alleen promo',
      note: 'Hier zie je de open flessen die nu actief gepromoot worden.',
      empty: 'Er staat momenteel geen open fles actief in promo.',
    },
  };
  const showInactiveBottleInventory = openBottleFilter === 'all';

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

  const historyFilterCards = useMemo(() => ([
    { key: 'all', label: 'Alles', count: transactions.length },
    { key: 'scan', label: 'Scans', count: transactions.filter(item => item.eventType === 'scan').length },
    { key: 'redeem', label: 'Inwisselingen', count: transactions.filter(item => item.eventType === 'redeem').length },
    { key: 'adjustment', label: 'Correcties', count: transactions.filter(item => item.eventType === 'adjustment').length },
  ] as const), [transactions]);

  const filteredAdjustmentCount = useMemo(
    () => filteredTransactions.filter(transaction => transaction.eventType === 'adjustment').length,
    [filteredTransactions],
  );

  const historyGroupedTransactions = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const groups: Array<{ key: string; label: string; note: string; items: CustomerTransaction[] }> = [
      { key: 'today', label: 'Vandaag', note: 'De meest recente scans, inwisselingen en correcties', items: [] },
      { key: 'yesterday', label: 'Gisteren', note: 'Alles wat gisteren geregistreerd werd', items: [] },
      { key: 'thisWeek', label: 'Afgelopen 7 dagen', note: 'Handig om recente verschillen of fouten na te kijken', items: [] },
      { key: 'earlier', label: 'Ouder', note: 'Oudere historiek voor opzoekwerk en controle', items: [] },
    ];

    filteredTransactions.forEach((transaction) => {
      const createdAt = new Date(transaction.createdAt);
      const timestamp = createdAt.getTime();
      if (!Number.isFinite(timestamp)) {
        groups[3].items.push(transaction);
        return;
      }

      if (createdAt >= startOfToday) {
        groups[0].items.push(transaction);
        return;
      }

      if (createdAt >= startOfYesterday) {
        groups[1].items.push(transaction);
        return;
      }

      if (createdAt >= startOfWeek) {
        groups[2].items.push(transaction);
        return;
      }

      groups[3].items.push(transaction);
    });

    return groups.filter(group => group.items.length > 0);
  }, [filteredTransactions]);

  const selectedCorrectionCustomer = useMemo(
    () => customers.find(customer => customer.id === selectedCorrectionCustomerId) ?? null,
    [customers, selectedCorrectionCustomerId],
  );

  useEffect(() => {
    if (!selectedCorrectionCustomerId && !correctionError && !correctionSuccess && !correctionSaving) return;

    setHistoryPanelsOpen(prev => (
      prev.correction
        ? prev
        : { ...prev, correction: true }
    ));
  }, [correctionError, correctionSaving, correctionSuccess, selectedCorrectionCustomerId]);

  useEffect(() => {
    if (!historySearch.trim()) return;

    setCollapsedHistoryGroups((prev) => {
      let changed = false;
      const next = { ...prev };

      historyGroupedTransactions.forEach((group) => {
        if (!next[group.key]) return;
        next[group.key] = false;
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [historyGroupedTransactions, historySearch]);

  const correctionControlEnabled = selectedCorrectionCustomer !== null;

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
  const activeHiddenAdminView = HIDDEN_ADMIN_VIEWS.find((item) => item.view === view) ?? null;
  const isCounterMode = view === 'create' || view === 'redeem';
  const brandLogoSrc = isDarkMode ? '/cozy_logo_wit.png' : '/cozylogo.png';

  return (
    <div className={cn('min-h-screen pb-32', isDarkMode ? 'admin-theme-dark bg-[#111315]' : 'bg-[#f5f5f0]')}>
      {/* Screensaver — activates after 60s idle, disappears on touch */}
      <Screensaver
        onWake={() => {
          setScreensaverPreviewSlides(null);
        }}
        slides={screensaverPreviewSlides ?? screensaverSlides}
        previewRequest={screensaverPreviewRequest}
      />

      <header className={cn('px-5 py-1.5 rounded-b-[24px] shadow-sm mb-5 sticky top-0 z-10', isDarkMode ? 'bg-[#121722] border-b border-white/10' : 'bg-white')}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center">
            {activeHiddenAdminView ? (
              <button
                onClick={() => {
                  reset();
                  setView('create');
                  setShowAdminMenu(false);
                }}
                className="ios-frosted inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold text-[var(--color-cozy-text)] transition-all hover:bg-white/80"
              >
                <ArrowLeft size={14} />
                Terug naar kassa
              </button>
            ) : (
              <div className="h-9 w-9" />
            )}
          </div>
          <div className="flex items-center justify-center">
            <img
              src={brandLogoSrc}
              alt="COZY Moments"
              className="w-[60px] h-[60px] object-contain"
            />
          </div>
          <div className="flex items-center justify-end">
            <div ref={adminMenuRef} className="relative flex items-center gap-2">
            <button
              onClick={() => setShowAdminMenu((current) => !current)}
              title="Beheer"
              aria-label="Beheer"
              className={cn(
                "ios-frosted h-9 w-9 rounded-full flex items-center justify-center transition-all",
                activeHiddenAdminView || showAdminMenu
                  ? "text-[var(--color-cozy-text)] shadow-sm ring-1 ring-white/35 bg-white/70"
                  : "text-gray-600 hover:bg-white/75"
              )}
            >
              <motion.span animate={{ rotate: showAdminMenu ? 30 : 0 }} transition={{ duration: 0.2 }}>
                <Settings2 size={17} />
              </motion.span>
            </button>

            <AnimatePresence>
              {showAdminMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className={cn("absolute right-0 top-full z-30 mt-2 w-60 rounded-[24px] border p-2 shadow-xl", isDarkMode ? "bg-[#2c3036] border-white/10" : "bg-white border-gray-100/80")}
                >
                  {HIDDEN_ADMIN_VIEWS.map((item) => (
                    <button
                      key={item.view}
                      onClick={() => {
                        reset();
                        setView(item.view);
                        setShowAdminMenu(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors",
                        view === item.view
                          ? isDarkMode ? "bg-white/15 text-[var(--color-cozy-text)] shadow-sm" : "bg-gray-100 text-[var(--color-cozy-text)] shadow-sm"
                          : isDarkMode ? "text-[#d8dee8] hover:bg-white/10" : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <span>{item.label}</span>
                      {view === item.view && <span className="text-xs text-[var(--color-cozy-olive)]">Open</span>}
                    </button>
                  ))}

                  <button
                    onClick={() => setIsDarkMode((current) => !current)}
                    className={cn("flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors", isDarkMode ? "text-[#d8dee8] hover:bg-white/10" : "text-gray-700 hover:bg-gray-50")}
                  >
                    <span className="inline-flex items-center gap-2">
                      {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                      {isDarkMode ? 'Lichte modus' : 'Donkere modus'}
                    </span>
                    <span className="text-xs text-[var(--color-cozy-olive)]">{isDarkMode ? 'Aan' : 'Uit'}</span>
                  </button>

                  <div className="mx-2 my-2 h-px bg-gray-200/70" />

                  <button
                    onClick={() => {
                      setShowAdminMenu(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-500 transition-colors hover:bg-red-50/80"
                  >
                    <LogOut size={16} />
                    <span>Uitloggen</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>
        </div>

        {isCounterMode && (
          <div className={cn('mt-2 grid grid-cols-2 gap-2 rounded-[26px] p-2', isDarkMode ? 'bg-[#171d29] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]' : 'ios-frosted')}>
            <motion.button
              whileTap={{ scale: 0.985 }}
              animate={view === 'create' ? { y: -1 } : { y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              onClick={() => { reset(); setView('create'); setShowAdminMenu(false); }}
              className={cn(
                "relative overflow-hidden rounded-[22px] px-3 py-3 text-center transition-all",
                isDarkMode
                  ? (view === 'create'
                    ? 'bg-[#212a39] shadow-[0_8px_18px_rgba(0,0,0,0.32)] ring-1 ring-white/10'
                    : 'bg-[#171f2d] hover:bg-[#1d2736] border border-white/8')
                  : (view === 'create'
                    ? "bg-white/90 shadow-[0_12px_28px_rgba(70,62,48,0.14)] ring-1 ring-white/45"
                    : "bg-white/25 hover:bg-[#ebe4d7]/55 hover:shadow-[0_8px_18px_rgba(70,62,48,0.08)]")
              )}
            >
              <div className={cn('pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent to-transparent', isDarkMode ? 'via-white/20' : 'via-white/85')} />
              <div className={cn(
                "pointer-events-none absolute inset-x-4 top-1 h-8 rounded-full blur-xl transition-opacity",
                isDarkMode
                  ? (view === 'create' ? 'bg-white/10 opacity-70' : 'bg-white/5 opacity-40')
                  : (view === 'create' ? "bg-white/70 opacity-100" : "bg-white/35 opacity-70")
              )} />
              <div className="relative flex flex-col items-center justify-center gap-1.5">
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                  isDarkMode
                    ? (view === 'create' ? 'bg-[#d8c9a8] text-[#4d3a1b] shadow-sm' : 'bg-[#d8c9a8]/75 text-[#4d3a1b]')
                    : (view === 'create' ? "bg-[#ebe4d7] text-[var(--color-cozy-olive)] shadow-sm" : "bg-[#ebe4d7]/70 text-[var(--color-cozy-olive)]")
                )}>
                  <QrCode size={22} />
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    "font-display text-[15px] font-bold leading-tight",
                    isDarkMode
                      ? (view === 'create' ? 'text-[#f2f5fa]' : 'text-[#d6dde8]')
                      : (view === 'create' ? "text-[var(--color-cozy-text)]" : "text-gray-700")
                  )}>
                    Nieuwe QR
                  </p>
                  <p className={cn('mt-0.5 text-[11px] leading-tight', isDarkMode ? 'text-[#aeb9c9]' : 'text-gray-400')}>
                    Punten toevoegen
                  </p>
                </div>
              </div>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.985 }}
              animate={view === 'redeem' ? { y: -1 } : { y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              onClick={() => { reset(); setView('redeem'); setShowAdminMenu(false); }}
              className={cn(
                "relative overflow-hidden rounded-[22px] px-3 py-3 text-center transition-all",
                isDarkMode
                  ? (view === 'redeem'
                    ? 'bg-[#212a39] shadow-[0_8px_18px_rgba(0,0,0,0.32)] ring-1 ring-white/10'
                    : 'bg-[#171f2d] hover:bg-[#1d2736] border border-white/8')
                  : (view === 'redeem'
                    ? "bg-white/90 shadow-[0_12px_28px_rgba(70,62,48,0.14)] ring-1 ring-white/45"
                    : "bg-white/25 hover:bg-[#ebe4d7]/55 hover:shadow-[0_8px_18px_rgba(70,62,48,0.08)]")
              )}
            >
              <div className={cn('pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent to-transparent', isDarkMode ? 'via-white/20' : 'via-white/85')} />
              <div className={cn(
                "pointer-events-none absolute inset-x-4 top-1 h-8 rounded-full blur-xl transition-opacity",
                isDarkMode
                  ? (view === 'redeem' ? 'bg-white/10 opacity-70' : 'bg-white/5 opacity-40')
                  : (view === 'redeem' ? "bg-white/70 opacity-100" : "bg-white/35 opacity-70")
              )} />
              <div className="relative flex flex-col items-center justify-center gap-1.5">
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                  isDarkMode
                    ? (view === 'redeem' ? 'bg-[#d8c9a8] text-[#4d3a1b] shadow-sm' : 'bg-[#d8c9a8]/75 text-[#4d3a1b]')
                    : (view === 'redeem' ? "bg-[#ebe4d7] text-[var(--color-cozy-olive)] shadow-sm" : "bg-[#ebe4d7]/70 text-[var(--color-cozy-olive)]")
                )}>
                  <Gift size={22} />
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    "font-display text-[15px] font-bold leading-tight",
                    isDarkMode
                      ? (view === 'redeem' ? 'text-[#f2f5fa]' : 'text-[#d6dde8]')
                      : (view === 'redeem' ? "text-[var(--color-cozy-text)]" : "text-gray-700")
                  )}>
                    Inwisselen
                  </p>
                  <p className={cn('mt-0.5 text-[11px] leading-tight', isDarkMode ? 'text-[#aeb9c9]' : 'text-gray-400')}>
                    Gratis drankje geven
                  </p>
                </div>
              </div>
            </motion.button>
          </div>
        )}
      </header>

      <main className="px-6">
        {view === 'create' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {!qrPayload ? (
              <div className="space-y-6">
                <h2 className={cn('text-3xl font-display font-bold text-[var(--color-cozy-text)] mb-8', isDarkMode && 'text-[#f4f2ea]')}>
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
                  isDarkMode={isDarkMode}
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
                  isDarkMode={isDarkMode}
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
                  isDarkMode={isDarkMode}
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
                  isDarkMode={isDarkMode}
                />

                <motion.button
                  onClick={generateQR}
                  disabled={totalConsumptions === 0}
                  animate={totalConsumptions > 0 ? { scale: [1, 1.025, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className={cn(
                    "w-full mt-8 rounded-full py-4 px-6 flex items-center justify-center gap-3 transition-all duration-300",
                    totalConsumptions > 0
                      ? (isDarkMode
                        ? 'bg-gradient-to-r from-[#d9c9ab] to-[#cdb995] border border-[#e8dcc9]/45 text-[#2e2210] shadow-[0_10px_24px_rgba(0,0,0,0.34)] active:scale-[0.98]'
                        : 'bg-gradient-to-r from-[#f0ebe0] to-[#e4dccf] border border-[var(--color-cozy-olive)]/25 text-[var(--color-cozy-text)] shadow-md active:scale-[0.98]')
                      : (isDarkMode
                        ? 'bg-[#2c3340] text-[#7f8da2] cursor-not-allowed border border-white/10'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-transparent')
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
                  <img src={brandLogoSrc} alt="" aria-hidden="true" className="w-48 h-48 object-contain opacity-10" />
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
              <div className={cn('relative flex flex-col items-center justify-center py-8', isDarkMode && 'rounded-[34px] bg-[#1a2230]/55 ring-1 ring-white/12 px-4')}>
                <img
                  src={brandLogoSrc}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 object-contain opacity-10"
                />
                <div className="relative p-6 md:p-8 rounded-[40px] shadow-xl mb-8 bg-[#ffffff] border border-black/5">
                  <QRCodeSVG value={qrPayload} size={300} level="H" bgColor="#FFFFFF" fgColor="#111111" />
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
                  <img src={brandLogoSrc} alt="" aria-hidden="true" className="w-48 h-48 object-contain opacity-10" />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {view === 'open-bottles' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-2">
              <div className="min-w-0">
                <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)]">
                  Open flessen
                </h2>
              </div>

              <div className="rounded-[24px] border border-white/70 bg-white/45 p-1.5 shadow-sm backdrop-blur-xl flex flex-wrap gap-1.5 md:flex-nowrap md:justify-end md:shrink-0">
                {([
                  { key: 'all', label: 'Alles', count: OPEN_BOTTLE_PRODUCTS.length },
                  { key: 'open', label: 'Open', count: activeOpenBottleItems.length },
                  { key: 'expired', label: 'Verlopen', count: expiredOpenBottleCount },
                  { key: 'promo', label: 'Promo', count: promoOpenBottleCount },
                ] as const).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setOpenBottleFilter(item.key)}
                    className={cn(
                      'inline-flex min-h-10 items-center gap-2 rounded-[16px] border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-all',
                      openBottleFilter === item.key
                        ? 'bg-white border-[var(--color-cozy-olive)]/20 text-[var(--color-cozy-text)] shadow-[0_4px_14px_rgba(70,62,48,0.12)]'
                        : 'border-transparent text-gray-500 hover:bg-white/70'
                    )}
                  >
                    <span>{item.label}</span>
                    <span className={cn(
                      'inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      openBottleFilter === item.key
                        ? 'bg-[var(--color-cozy-olive)]/10 text-[var(--color-cozy-olive)]'
                        : 'bg-white/70 text-gray-500'
                    )}>
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Open nu</p>
                <p className="font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{activeOpenBottleItems.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Over tijd</p>
                <p className="font-mono text-2xl font-bold text-red-500">{expiredOpenBottleCount}</p>
              </div>
              <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-400">In promo</p>
                <p className="font-mono text-2xl font-bold text-[var(--color-cozy-olive)]">{activePromos.length}</p>
              </div>
            </div>

            <div className="ios-frosted-amber rounded-[24px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone size={16} className="text-[var(--color-cozy-olive)]" />
                <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Wat klanten nu zien</span>
              </div>
              {activePromos.length > 0 ? (
                <div className="space-y-2">
                  {activePromos.map((promo) => {
                    const product = OPEN_BOTTLE_PRODUCT_MAP[promo.productId];
                    return (
                      <div key={promo.productId} className="rounded-2xl border border-amber-200/50 bg-white/45 px-4 py-3">
                        <p className="text-sm text-[var(--color-cozy-text)]/85 leading-snug">{promo.promoMessage}</p>
                        {product && (
                          <span className="mt-2 inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--color-cozy-olive)] shadow-sm">
                            {product.name}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={clearAllPromos}
                    disabled={promoSaving}
                    className="text-xs text-red-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    Alle promo's wissen
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-amber-200/60 bg-white/40 px-4 py-3 text-sm text-gray-500">
                  Er staat momenteel geen banner live voor klanten.
                </div>
              )}
            </div>

            {filteredActiveOpenBottleItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 pt-1">
                  <span className="inline-flex items-center rounded-full border border-[var(--color-cozy-olive)]/20 bg-[var(--color-cozy-olive)]/8 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-cozy-olive)]">
                    {openBottleFilterMeta[openBottleFilter].title}
                  </span>
                  <p className="text-sm text-gray-500">{openBottleFilterMeta[openBottleFilter].note}</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {filteredActiveOpenBottleItems.map((item) => (
                    <div
                      key={item.product.id}
                      className={cn(
                        'rounded-[24px] border p-4 shadow-sm transition-colors',
                        item.isPromoActive
                          ? 'bg-[var(--color-cozy-olive)]/5 border-[var(--color-cozy-olive)]/20'
                          : 'bg-white border-gray-200'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
                              item.product.risk === 'red'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            )}>
                              Opvolgen
                            </span>
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                              {item.product.priceLabel}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                              {item.remainingLabel}
                            </span>
                          </div>
                          <h3 className="text-lg font-display font-bold text-[var(--color-cozy-text)] leading-tight">
                            {item.product.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-2 leading-relaxed">{item.product.reason}</p>

                          {item.entry && (
                            <p className="text-xs text-gray-400 mt-3">
                              Open sinds {new Date(item.entry.openedAt).toLocaleString('nl-BE', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}

                        </div>

                        <div className="min-w-[248px] grid grid-cols-2 gap-2">
                          <div
                            className={cn(
                              'rounded-2xl border px-3 py-2 text-center',
                              item.remainingCountValue >= Math.ceil(item.product.maxRemainingCount * 0.66)
                                ? 'bg-red-50 border-red-200 text-red-600'
                                : item.remainingCountValue >= Math.ceil(item.product.maxRemainingCount * 0.34)
                                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            )}
                          >
                            <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80">Nog over</p>
                            <p className="font-mono text-2xl font-bold leading-tight">{item.remainingCountValue}</p>
                            <p className="text-[11px] font-semibold opacity-90">
                              {item.remainingCountValue === 1 ? item.product.unitSingular : item.product.unitPlural} over
                            </p>
                          </div>
                          <div className={cn(
                            'rounded-2xl border px-3 py-2 text-center',
                            item.isExpired
                              ? 'bg-red-50 border-red-200 text-red-600'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          )}>
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <Clock3 size={14} />
                              <span className="text-[10px] uppercase tracking-wider font-semibold">Timer</span>
                            </div>
                            <p className="font-mono text-sm font-bold">
                              {item.isExpired
                                ? `${formatDuration(Math.abs(item.remainingMs ?? 0))} te laat`
                                : formatDuration(item.remainingMs ?? 0)}
                            </p>
                            <p className="text-[10px] mt-1 opacity-80">
                              {item.isExpired ? 'Tijd om te duwen of af te sluiten' : 'Tijd resterend'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 w-full">
                        <button
                          onClick={() => handleOpenBottle(item.product.id)}
                          disabled={promoSaving}
                          className="ios-frosted w-full min-h-14 rounded-2xl border border-white/70 px-3 py-3 text-sm font-semibold text-[var(--color-cozy-text)] hover:bg-white/80 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          Timer herstarten
                        </button>
                        <button
                          onClick={() => handlePromoteBottle(item.product)}
                          disabled={promoSaving || (!item.isPromoActive && activePromos.length >= MAX_ACTIVE_PROMOS)}
                          className={cn(
                            'ios-frosted w-full min-h-14 rounded-2xl border px-3 py-3 text-sm font-semibold transition-all active:scale-[0.98]',
                            item.isPromoActive
                              ? 'border-[var(--color-cozy-olive)]/30 bg-[var(--color-cozy-olive)]/10 text-[var(--color-cozy-olive)] hover:bg-[var(--color-cozy-olive)]/15'
                              : 'border-white/70 text-[var(--color-cozy-text)] hover:bg-white/80',
                            (promoSaving || (!item.isPromoActive && activePromos.length >= MAX_ACTIVE_PROMOS)) && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {item.isPromoActive ? 'Uit promo halen' : activePromos.length >= MAX_ACTIVE_PROMOS ? `Max ${MAX_ACTIVE_PROMOS} promos` : 'Zet in promo'}
                        </button>
                        <button
                          onClick={() => handleSoldUnit(item.product.id)}
                          disabled={promoSaving}
                          className="ios-frosted w-full min-h-14 rounded-2xl border border-white/70 px-3 py-3 text-sm font-semibold text-[var(--color-cozy-text)] hover:bg-white/80 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {item.soldButtonLabel}
                        </button>
                        <button
                          onClick={() => handleClearBottle(item.product.id)}
                          disabled={promoSaving}
                          className="ios-frosted w-full min-h-14 rounded-2xl border border-white/70 px-3 py-3 text-sm font-semibold text-[var(--color-cozy-text)] hover:bg-white/80 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          Fles weg
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showInactiveBottleInventory && (['red', 'orange'] as OpenBottleRisk[]).map(risk => {
              const products = inactiveOpenBottleItems.filter(item => item.product.risk === risk);
              const riskConfig = risk === 'red'
                ? {
                    title: 'Opvolgen: nog niet open',
                    note: 'Zodra je hier iets opent, wil je het meteen kunnen opvolgen.',
                    badge: 'bg-red-50 text-red-600 border-red-200',
                  }
                : {
                    title: 'Opvolgen: nog niet open',
                    note: 'Minder kritisch, maar nog altijd handig om per fles snel te starten.',
                    badge: 'bg-amber-50 text-amber-700 border-amber-200',
                  };

              if (products.length === 0) return null;

              return (
                <div key={risk} className="space-y-3">
                  <button
                    onClick={() => setCollapsedInactiveBottleGroups((current) => ({
                      ...current,
                      [risk]: !current[risk],
                    }))}
                    className="flex w-full items-center justify-between gap-3 rounded-[22px] bg-white px-4 py-3 text-left shadow-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider', riskConfig.badge)}>
                        {riskConfig.title}
                      </span>
                      <p className="text-sm text-gray-500">{riskConfig.note}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                        {products.length}
                      </span>
                      <motion.span
                        animate={{ rotate: collapsedInactiveBottleGroups[risk] ? 0 : 180 }}
                        transition={{ duration: 0.2 }}
                        className="text-gray-400"
                      >
                        <ChevronDown size={18} />
                      </motion.span>
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {!collapsedInactiveBottleGroups[risk] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 pt-1">
                          {products.map((item) => {
                            return (
                              <div
                                key={item.product.id}
                                className="rounded-[24px] border border-gray-100 bg-white/80 p-4 shadow-sm transition-colors"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                                        {item.product.priceLabel}
                                      </span>
                                    </div>
                                    <h3 className="text-base font-display font-bold text-[var(--color-cozy-text)] leading-tight">
                                      {item.product.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-3">{item.product.reason}</p>
                                  </div>

                                  <div className="min-w-[108px] rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-center text-gray-400">
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                      <Clock3 size={14} />
                                      <span className="text-[10px] uppercase tracking-wider font-semibold">Timer</span>
                                    </div>
                                    <p className="font-mono text-sm font-bold">Niet open</p>
                                    <p className="text-[10px] mt-1 opacity-80">{item.product.expiryHours}u venster</p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2 mt-4">
                                  <button
                                    onClick={() => handleOpenBottle(item.product.id)}
                                    disabled={promoSaving}
                                    className="ios-frosted min-h-11 rounded-2xl border border-white/70 px-4 py-2.5 text-sm font-semibold text-[var(--color-cozy-text)] hover:bg-white/80 active:scale-[0.98] transition-all disabled:opacity-50"
                                  >
                                    + Nieuwe fles
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                    a.remove();
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
                    const name = `"${c.name.replaceAll('"', '""')}"`;
                    const email = `"${(c.email || '').replaceAll('"', '""')}"`;
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
                    lines.push(
                      '────────────────────────────────────────',
                      `${i + 1}. ${c.name}`,
                      `   E-mail:        ${c.email || '—'}`,
                      `   Level:         ${LOYALTY_TIER_CONFIG[c.loyaltyTier].label} (${c.loyaltyPoints} punten)`,
                      `   Klant sinds:   ${since}`,
                      `   Laatste bezoek: ${lastVisit}`,
                      `   Totaal bezoeken: ${c.totalVisits || 0}`,
                      `   Favoriet:      ${st.hasFavorite ? cardTypeLabels[st.favorite] : '—'}`,
                      `   Geschatte omzet: €${st.estimatedRevenue.toFixed(2)}`,
                      `   Loyaliteitskorting: €${st.estimatedGivenAway.toFixed(2)}`,
                      `   Totaal:        Koffie: ${st.total.coffee}  |  Wijn: ${st.total.wine}  |  Bier: ${st.total.beer}  |  Frisdrank: ${st.total.soda}`,
                      `   Gem/maand:     Koffie: ${st.avgPerMonth.coffee.toFixed(1)}  |  Wijn: ${st.avgPerMonth.wine.toFixed(1)}  |  Bier: ${st.avgPerMonth.beer.toFixed(1)}  |  Frisdrank: ${st.avgPerMonth.soda.toFixed(1)}`,
                      `   Stempels:      Koffie: ${c.cards.coffee}/10  |  Wijn: ${c.cards.wine}/10  |  Bier: ${c.cards.beer}/10  |  Frisdrank: ${c.cards.soda}/10`,
                      `   Volle kaarten: Koffie: ${c.rewards.coffee || 0}  |  Wijn: ${c.rewards.wine || 0}  |  Bier: ${c.rewards.beer || 0}  |  Frisdrank: ${c.rewards.soda || 0}`,
                      `   Ingewisseld:   Koffie: ${c.claimedRewards?.coffee || 0}  |  Wijn: ${c.claimedRewards?.wine || 0}  |  Bier: ${c.claimedRewards?.beer || 0}  |  Frisdrank: ${c.claimedRewards?.soda || 0}`,
                      '',
                    );
                  });
                  lines.push(
                    '════════════════════════════════════════════════════',
                    '  TOTAAL VERKOCHT — ALLE KLANTEN SAMEN',
                    '════════════════════════════════════════════════════',
                    `  Koffie:    ${grandTotal.coffee} consumpties`,
                    `  Wijn:      ${grandTotal.wine} consumpties`,
                    `  Bier:      ${grandTotal.beer} consumpties`,
                    `  Frisdrank: ${grandTotal.soda} consumpties`,
                    '',
                    'Geëxporteerd door Cozy Moments Loyalty',
                  );

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

            {/* ── Actieve promo's ────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone size={16} className="text-[var(--color-cozy-olive)]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Actieve promo's voor klanten</span>
              </div>
              {activePromos.length > 0 ? (
                <div className="space-y-2">
                  {activePromos.map((promo) => (
                    <div key={promo.productId} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-[var(--color-cozy-text)]">
                      {promo.promoMessage}
                    </div>
                  ))}
                  <p className="text-xs text-gray-400">Beheer promo's via het Open flessen-paneel.</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Geen actieve promo's. Open het Open flessen-paneel om een fles in promo te zetten.</p>
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
                                {stats.loyaltyProgress.nextTier ? `tot ${LOYALTY_TIER_CONFIG[stats.loyaltyProgress.nextTier].label}` : 'Platinum-status'}
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
                                {stats.loyaltyProgress.nextTier ? `${stats.loyaltyProgress.progressPercent}% naar ${LOYALTY_TIER_CONFIG[stats.loyaltyProgress.nextTier].label}` : 'Platinum bereikt'}
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
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)] flex items-center gap-3">
                  <History size={28} className="text-[var(--color-cozy-olive)]" />
                  Historiek & correcties
                </h2>
              </div>
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm min-w-[220px]">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Actieve medewerker</p>
                <p className="font-mono text-sm font-bold text-[var(--color-cozy-text)] break-all">{adminEmail ?? 'Onbekend'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.4fr] gap-4 items-start">
              <div className="bg-white rounded-[28px] shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setHistoryPanelsOpen(prev => ({ ...prev, correction: !prev.correction }))}
                  className="w-full px-5 py-5 flex items-start justify-between gap-4 text-left"
                >
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Manuele correctie</p>
                    <h3 className="text-xl font-display font-bold text-[var(--color-cozy-text)]">Nieuwe correctie registreren</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedCorrectionCustomer
                        ? `Je corrigeert momenteel ${selectedCorrectionCustomer.name}`
                        : 'Tap om open te klappen en een correctie te starten.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {selectedCorrectionCustomer && (
                      <span className="rounded-full bg-[var(--color-cozy-olive)]/10 px-3 py-1 text-[11px] font-medium text-[var(--color-cozy-olive)]">
                        Klant gekozen
                      </span>
                    )}
                    <motion.span
                      animate={{ rotate: historyPanelsOpen.correction ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                    >
                      <ChevronDown size={18} />
                    </motion.span>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {historyPanelsOpen.correction && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: 'easeInOut' }}
                      className="overflow-hidden border-t border-gray-100"
                    >
                      <div className="p-5 space-y-4">
                        <div>
                          <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Klant</label>
                          <select
                            value={selectedCorrectionCustomerId}
                            onChange={(event) => {
                              setSelectedCorrectionCustomerId(event.target.value);
                              setCorrectionError(null);
                              setCorrectionSuccess(null);
                            }}
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

                        {selectedCorrectionCustomer && (
                          <div className="rounded-[24px] border border-[var(--color-cozy-olive)]/15 bg-[var(--color-cozy-olive)]/5 px-4 py-4 space-y-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Huidige klantstatus</p>
                              <p className="text-base font-display font-bold text-[var(--color-cozy-text)]">{selectedCorrectionCustomer.name}</p>
                              <p className="text-sm text-gray-500">{selectedCorrectionCustomer.email || 'Geen e-mail'} • {selectedCorrectionCustomer.totalVisits} bezoeken</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-4">
                              {(Object.keys(cardTypeLabels) as CardType[]).map((type) => (
                                <div key={`current-status-${type}`} className="rounded-2xl bg-white/80 px-3 py-2">
                                  <p className="font-medium text-[var(--color-cozy-text)]">{cardTypeLabels[type]}</p>
                                  <p>Kaart: {selectedCorrectionCustomer.cards[type]}</p>
                                  <p>Beloningen: {selectedCorrectionCustomer.rewards[type]}</p>
                                  <p>Ingewisseld: {selectedCorrectionCustomer.claimedRewards[type]}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

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

                        <div className="space-y-3 rounded-[24px] border border-gray-100 bg-gray-50/70 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400 uppercase tracking-wider">Stempels huidige kaart</p>
                            <span className="text-[11px] text-gray-400">Moet tussen 0 en 9 uitkomen</span>
                          </div>
                          {(Object.keys(cardTypeLabels) as CardType[]).map((type) => (
                            <DeltaControl
                              key={`stamp-${type}`}
                              label={cardTypeLabels[type]}
                              value={correctionStamps[type]}
                              baseValue={selectedCorrectionCustomer?.cards[type] ?? 0}
                              onChange={(value) => changeCorrectionRecord('stamps', type, value)}
                              accent="olive"
                              minValue={selectedCorrectionCustomer ? -selectedCorrectionCustomer.cards[type] : undefined}
                              maxValue={selectedCorrectionCustomer ? 9 - selectedCorrectionCustomer.cards[type] : undefined}
                              disabled={!correctionControlEnabled}
                            />
                          ))}
                        </div>

                        <div className="space-y-3 rounded-[24px] border border-gray-100 bg-gray-50/70 p-4">
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Beschikbare beloningen</p>
                          {(Object.keys(cardTypeLabels) as CardType[]).map((type) => (
                            <DeltaControl
                              key={`reward-${type}`}
                              label={cardTypeLabels[type]}
                              value={correctionRewards[type]}
                              baseValue={selectedCorrectionCustomer?.rewards[type] ?? 0}
                              onChange={(value) => changeCorrectionRecord('rewards', type, value)}
                              accent="amber"
                              minValue={selectedCorrectionCustomer ? -selectedCorrectionCustomer.rewards[type] : undefined}
                              disabled={!correctionControlEnabled}
                            />
                          ))}
                        </div>

                        <div className="space-y-3 rounded-[24px] border border-gray-100 bg-gray-50/70 p-4">
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Ingewisselde beloningen</p>
                          {(Object.keys(cardTypeLabels) as CardType[]).map((type) => (
                            <DeltaControl
                              key={`claimed-${type}`}
                              label={cardTypeLabels[type]}
                              value={correctionClaimed[type]}
                              baseValue={selectedCorrectionCustomer?.claimedRewards[type] ?? 0}
                              onChange={(value) => changeCorrectionRecord('claimed', type, value)}
                              accent="rose"
                              minValue={selectedCorrectionCustomer ? -selectedCorrectionCustomer.claimedRewards[type] : undefined}
                              disabled={!correctionControlEnabled}
                            />
                          ))}
                        </div>

                        <div className="space-y-2 rounded-[24px] border border-gray-100 bg-gray-50/70 p-4">
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Bezoeken</p>
                          <DeltaControl
                            label="Totaal bezoeken"
                            value={correctionVisitDelta}
                            baseValue={selectedCorrectionCustomer?.totalVisits ?? 0}
                            onChange={setCorrectionVisitDelta}
                            accent="blue"
                            minValue={selectedCorrectionCustomer ? -selectedCorrectionCustomer.totalVisits : undefined}
                            disabled={!correctionControlEnabled}
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-[28px] shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setHistoryPanelsOpen(prev => ({ ...prev, filters: !prev.filters }))}
                    className="w-full px-5 py-5 flex items-start justify-between gap-4 text-left"
                  >
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Auditfilter</p>
                      <h3 className="text-xl font-display font-bold text-[var(--color-cozy-text)]">Zoeken & snel filteren</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {filteredTransactions.length} zichtbare registraties, waarvan {filteredAdjustmentCount} correcties.
                      </p>
                    </div>
                    <motion.span
                      animate={{ rotate: historyPanelsOpen.filters ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 flex-shrink-0"
                    >
                      <ChevronDown size={18} />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {historyPanelsOpen.filters && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: 'easeInOut' }}
                        className="overflow-hidden border-t border-gray-100"
                      >
                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {historyFilterCards.map((item) => (
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
                      </motion.div>
                    )}
                  </AnimatePresence>
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

                  {!transactionsLoading && !transactionsError && historyGroupedTransactions.map((group) => (
                    <div key={group.key} className="bg-white rounded-[28px] shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCollapsedHistoryGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                        className="w-full px-5 py-4 flex items-start justify-between gap-4 text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-display font-bold text-[var(--color-cozy-text)]">{group.label}</h3>
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-500">
                              {group.items.length} item{group.items.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{group.note}</p>
                        </div>
                        <motion.span
                          animate={{ rotate: collapsedHistoryGroups[group.key] ? 0 : 180 }}
                          transition={{ duration: 0.2 }}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 flex-shrink-0"
                        >
                          <ChevronDown size={18} />
                        </motion.span>
                      </button>

                      <AnimatePresence initial={false}>
                        {!collapsedHistoryGroups[group.key] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.24, ease: 'easeInOut' }}
                            className="overflow-hidden border-t border-gray-100"
                          >
                            <div className="p-4 space-y-3">
                              {group.items.map((transaction) => {
                                const summaryParts = buildTransactionSummaryParts(transaction);
                                const badgeClasses = transaction.eventType === 'scan'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : transaction.eventType === 'redeem'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200';

                                return (
                                  <div key={transaction.id} className="rounded-[24px] border border-gray-100 bg-gray-50/70 p-5 space-y-3">
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
                                          <span key={part} className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 border border-gray-100">
                                            {part}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {transaction.reason && (
                                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-gray-600 border border-gray-100">
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
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'screensaver' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ScreensaverEditor
              isDarkMode={isDarkMode}
              slides={screensaverDraft}
              dirty={screensaverDirty}
              saving={screensaverSaving}
              uploadingTarget={screensaverUploadingTarget}
              error={screensaverError}
              success={screensaverSuccess}
              onMoveSlide={handleScreensaverMove}
              onSwapSlideSides={handleScreensaverSwapSides}
              onDurationChange={handleScreensaverDurationChange}
              onUploadImage={handleScreensaverUpload}
              onResetImage={handleScreensaverResetImage}
              onResetAll={handleScreensaverResetAll}
              onPreview={handleScreensaverPreview}
              onSave={saveScreensaver}
            />
          </motion.div>
        )}

        {view === 'drink-menu' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <DrinkMenuEditor
              isDarkMode={isDarkMode}
              sections={drinkMenuDraft}
              activePromoItemIds={activePromoDrinkMenuItemIds}
              activePromoProductName={activePromoProductNames.length > 0 ? activePromoProductNames.join(', ') : null}
              dirty={drinkMenuDirty}
              saving={drinkMenuSaving}
              error={drinkMenuError}
              success={drinkMenuSuccess}
              onAddSection={handleDrinkMenuAddSection}
              onMoveSection={handleDrinkMenuMoveSection}
              onRemoveSection={handleDrinkMenuRemoveSection}
              onReset={resetDrinkMenuDraft}
              onSave={saveDrinkMenu}
              onUpdateSection={handleDrinkMenuSectionUpdate}
              onAddItem={handleDrinkMenuAddItem}
              onMoveItem={handleDrinkMenuMoveItem}
              onRemoveItem={handleDrinkMenuRemoveItem}
              onUpdateItem={handleDrinkMenuItemUpdate}
            />
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
                  <img src={brandLogoSrc} alt="" aria-hidden="true" className="w-48 h-48 object-contain opacity-10" />
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
              <div className={cn('relative flex flex-col items-center justify-center py-8', isDarkMode && 'rounded-[34px] bg-[#1a2230]/55 ring-1 ring-white/12 px-4')}>
                <img
                  src={brandLogoSrc}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 object-contain opacity-10"
                />
                <div className="relative p-6 md:p-8 rounded-[40px] shadow-xl mb-8 bg-[#ffffff] border border-black/5">
                  <QRCodeSVG value={qrPayload} size={300} level="H" bgColor="#FFFFFF" fgColor="#111111" />
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
                  <img src={brandLogoSrc} alt="" aria-hidden="true" className="w-48 h-48 object-contain opacity-10" />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      <div className="pointer-events-none flex justify-end px-6 pb-2">
        <div className="h-9 w-[142px] max-w-full rounded-full" />
      </div>

      <a
        href="https://www.webaanzee.be"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'ios-frosted fixed bottom-[calc(env(safe-area-inset-bottom)+0.9rem)] right-4 z-20 inline-flex max-w-[calc(100vw-2rem)] items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-medium opacity-80 transition-all hover:-translate-y-0.5 hover:opacity-100 hover:bg-white/80',
          isDarkMode ? 'text-[#e8ecf2]' : 'text-[#1f1f1f]/90'
        )}
        style={{ letterSpacing: '0.04em', textDecoration: 'none' }}
      >
        <span className={cn('whitespace-nowrap', isDarkMode ? 'text-[#d2d9e3]' : 'text-black/55')}>realisatie door</span>
        <span className="whitespace-nowrap font-semibold">
          <span style={{ color: isDarkMode ? '#f3f5f8' : '#111' }}>Web</span><span style={{ color: '#f59e0b' }}>aan</span><span style={{ color: isDarkMode ? '#f3f5f8' : '#111' }}>Zee</span>
        </span>
      </a>

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
  isDarkMode: boolean;
}

interface DeltaControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  accent: 'olive' | 'amber' | 'rose' | 'blue';
  baseValue?: number;
  minValue?: number;
  maxValue?: number;
  disabled?: boolean;
}

const deltaAccentClass: Record<DeltaControlProps['accent'], string> = {
  olive: 'bg-[var(--color-cozy-olive)]/8 text-[var(--color-cozy-text)]',
  amber: 'bg-amber-50 text-amber-800',
  rose: 'bg-rose-50 text-rose-800',
  blue: 'bg-blue-50 text-blue-800',
};

const deltaAccentBorderClass: Record<DeltaControlProps['accent'], string> = {
  olive: 'border-[var(--color-cozy-olive)]/15',
  amber: 'border-amber-200/70',
  rose: 'border-rose-200/70',
  blue: 'border-blue-200/70',
};

const DeltaControl: React.FC<DeltaControlProps> = ({
  label,
  value,
  onChange,
  accent,
  baseValue,
  minValue,
  maxValue,
  disabled = false,
}) => {
  const displayValue = baseValue ?? value;
  const effectiveValue = baseValue !== undefined ? baseValue + value : value;
  const changeText = value === 0 ? 'Geen wijziging' : `Wijziging ${value > 0 ? `+${value}` : value}`;
  const helperText = baseValue !== undefined ? 'Min = terugdraaien, plus = toevoegen' : 'Negatief = terugdraaien, positief = toevoegen';
  const canDecrease = !disabled && (minValue === undefined || value > minValue);
  const canIncrease = !disabled && (maxValue === undefined || value < maxValue);

  const updateValue = (nextValue: number) => {
    const clampedValue = Math.max(minValue ?? Number.NEGATIVE_INFINITY, Math.min(maxValue ?? Number.POSITIVE_INFINITY, nextValue));
    onChange(clampedValue);
  };

  return (
    <div className={cn(
      'bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 flex items-center justify-between gap-3',
      disabled && 'opacity-60'
    )}>
      <div>
        <p className="text-sm font-medium text-[var(--color-cozy-text)]">{label}</p>
        <p className="text-[11px] text-gray-400">{helperText}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => updateValue(value - 1)}
          disabled={!canDecrease}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-transform disabled:opacity-40 disabled:hover:bg-white disabled:active:scale-100"
        >
          <Minus size={16} />
        </button>
        <div className="min-w-[110px] space-y-1 text-center">
          <span className={cn(
            'block rounded-full border bg-white px-3 py-1.5 font-mono text-sm font-bold text-[var(--color-cozy-text)]',
            deltaAccentBorderClass[accent],
          )}>
            {effectiveValue}
          </span>
          <span className={cn(
            'block rounded-full px-3 py-1 text-[11px] font-semibold',
            deltaAccentClass[accent],
            value === 0 && 'bg-gray-100 text-gray-500',
          )}>
            {changeText}
          </span>
        </div>
        <button
          type="button"
          onClick={() => updateValue(value + 1)}
          disabled={!canIncrease}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-transform disabled:opacity-40 disabled:hover:bg-white disabled:active:scale-100"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

const ConsumptionRow: React.FC<ConsumptionRowProps> = ({ title, icon: Icon, count, onInc, onDec, color, bg, index, isDarkMode }) => {
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
    <div className={cn('rounded-[24px] p-4 shadow-sm flex items-center justify-between overflow-hidden', isDarkMode ? 'bg-[#171c24] border border-white/10' : 'bg-white')}>
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
          className={cn('font-display font-bold text-xl', isDarkMode ? 'text-[#f4f2ea]' : 'text-[var(--color-cozy-text)]')}
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
          className={cn('w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 active:scale-90 transition-transform', isDarkMode ? 'bg-[#8f98a6] text-[#1a202a]' : 'bg-gray-100 text-gray-600')}
        >
          <Minus size={20} />
        </button>

        {/* Animated count */}
        <motion.span
          animate={countControls}
          className={cn('font-mono text-xl font-medium w-6 text-center inline-block', isDarkMode ? 'text-[#f6f8fb]' : 'text-[var(--color-cozy-text)]')}
        >
          {count}
        </motion.span>

        <button
          onClick={handleInc}
          className={cn('w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform', isDarkMode ? 'bg-[#edf1f7] text-[#1a202a]' : 'bg-gray-100 text-gray-600')}
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};
