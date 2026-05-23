import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, LogOut, Gift, ChevronRight, Megaphone, X, Mail, Award, CalendarDays, BookOpen, TriangleAlert, Bell, BellOff, Smartphone } from 'lucide-react';
import { useLoyalty, CardType } from '../../shared/store/LoyaltyContext';
import { useAuth } from '../../shared/store/AuthContext';
import { LoyaltyCard } from '../../shared/components/LoyaltyCard';
import { LoadingScreen } from '../../shared/components/LoadingScreen';
import { supabase } from '../../shared/lib/supabase';
import { normalizeActivePromos, type ActivePromo } from '../../shared/lib/drink-menu';
import { getCustomerContactLabel } from '../../shared/lib/customer-accounts';
import { formatCustomerBirthdays, normalizeBirthdayInput } from '../../shared/lib/customer-birthday';
import { LOYALTY_TIER_CONFIG, LOYALTY_TIER_ORDER, getLoyaltyProgress } from '../../shared/lib/loyalty-tier';
import {
  fetchCustomerPushState,
  getInitialCustomerPushState,
  subscribeCustomerToPush,
  unsubscribeCustomerFromPush,
  updateCustomerPushPreferences,
  type CustomerPushState,
} from '../../shared/lib/customer-push';
import { motion, AnimatePresence } from 'framer-motion';

const CARD_TYPES: CardType[] = ['coffee', 'wine', 'beer', 'soda'];
const PROMO_ROTATION_INTERVAL_MS = 10_000;

export const CustomerPage: React.FC = () => {
  const { currentCustomer, updateCustomerBirthday } = useLoyalty();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(true);
  const [justRegistered, setJustRegistered] = useState<string | null>(null);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [promoMessages, setPromoMessages] = useState<string[]>([]);
  const [promoIndex, setPromoIndex] = useState(0);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [fillFromCards, setFillFromCards] = useState<Partial<Record<CardType, number>> | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pushState, setPushState] = useState<CustomerPushState>(() => getInitialCustomerPushState(null));
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [birthdayDraft, setBirthdayDraft] = useState({ day: '', month: '', year: '', partnerFirstName: '', partnerDay: '', partnerMonth: '', partnerYear: '' });
  const [showPartnerBirthday, setShowPartnerBirthday] = useState(false);
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [birthdayMessage, setBirthdayMessage] = useState<string | null>(null);
  const [birthdayError, setBirthdayError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowWelcome(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Detect first-time registration
  useEffect(() => {
    try {
      const regName = sessionStorage.getItem('cozy-just-registered');
      if (regName) {
        setJustRegistered(regName);
        sessionStorage.removeItem('cozy-just-registered');
        const t = setTimeout(() => setJustRegistered(null), 5000);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  // Fetch promo messages (multi-promo with fallback to legacy single promo)
  useEffect(() => {
    if (!supabase) return;

    const loadPromos = async () => {
      const { data, error } = await supabase.from('site_settings').select('promo_message, active_promos').eq('id', 'default').single();
      if (error) {
        console.error('Kon promo banner niet laden:', error);
        return;
      }
      const promos = normalizeActivePromos((data as { active_promos?: unknown } | null)?.active_promos);
      if (promos.length > 0) {
        setPromoMessages(promos.map((p) => p.promoMessage));
      } else {
        // Backward compat: fall back to legacy single promo_message
        const legacy = data?.promo_message ?? '';
        setPromoMessages(legacy ? [legacy] : []);
      }
      setPromoIndex(0);
    };

    loadPromos();

    const channel = supabase
      .channel('site-settings-realtime-customer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => {
        loadPromos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Rotate promo messages every 10 seconds when there are multiple
  useEffect(() => {
    if (promoMessages.length <= 1) return;
    const interval = globalThis.setInterval(() => {
      setPromoIndex((current) => (current + 1) % promoMessages.length);
    }, PROMO_ROTATION_INTERVAL_MS);
    return () => globalThis.clearInterval(interval);
  }, [promoMessages.length]);

  // If currentCustomer doesn't load within 8s, show escape hatch
  useEffect(() => {
    if (currentCustomer) return;
    const t = setTimeout(() => setLoadTimeout(true), 8000);
    return () => clearTimeout(t);
  }, [currentCustomer]);

  const displayName = user?.name || currentCustomer?.name || 'Gebruiker';
  const profilePhoto = user?.avatar?.trim() || '';
  const showProfilePhoto = Boolean(profilePhoto) && !avatarLoadFailed;
  const profileInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'G';

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profilePhoto]);

  useEffect(() => {
    if (!currentCustomer) return;

    try {
      const raw = sessionStorage.getItem('cozy-card-fill-animation');
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        customerId?: string;
        createdAt?: number;
        fromCards?: Partial<Record<CardType, number>>;
      };

      const isSameCustomer = parsed.customerId === currentCustomer.id;
      const isFresh = typeof parsed.createdAt === 'number' && Date.now() - parsed.createdAt < 2 * 60 * 1000;

      if (isSameCustomer && isFresh && parsed.fromCards) {
        setFillFromCards(parsed.fromCards);
        setTimeout(() => setFillFromCards(null), 1200);
      }

      sessionStorage.removeItem('cozy-card-fill-animation');
    } catch {
      sessionStorage.removeItem('cozy-card-fill-animation');
    }
  }, [currentCustomer]);

  useEffect(() => {
    if (!currentCustomer) {
      setPushState(getInitialCustomerPushState(null));
      return;
    }

    let cancelled = false;
    void fetchCustomerPushState(currentCustomer).then((nextState) => {
      if (!cancelled) {
        setPushState(nextState);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentCustomer?.id, currentCustomer?.totalVisits, currentCustomer?.rewards.coffee, currentCustomer?.rewards.wine, currentCustomer?.rewards.beer, currentCustomer?.rewards.soda]);

  useEffect(() => {
    setBirthdayDraft({
      day: currentCustomer?.birthdayDay ? String(currentCustomer.birthdayDay) : '',
      month: currentCustomer?.birthdayMonth ? String(currentCustomer.birthdayMonth) : '',
      year: currentCustomer?.birthdayYear ? String(currentCustomer.birthdayYear) : '',
      partnerFirstName: currentCustomer?.partnerFirstName ?? '',
      partnerDay: currentCustomer?.partnerBirthdayDay ? String(currentCustomer.partnerBirthdayDay) : '',
      partnerMonth: currentCustomer?.partnerBirthdayMonth ? String(currentCustomer.partnerBirthdayMonth) : '',
      partnerYear: currentCustomer?.partnerBirthdayYear ? String(currentCustomer.partnerBirthdayYear) : '',
    });
    setShowPartnerBirthday(Boolean(currentCustomer?.partnerFirstName));
  }, [currentCustomer?.id, currentCustomer?.birthdayDay, currentCustomer?.birthdayMonth, currentCustomer?.birthdayYear, currentCustomer?.partnerFirstName, currentCustomer?.partnerBirthdayDay, currentCustomer?.partnerBirthdayMonth, currentCustomer?.partnerBirthdayYear]);

  useEffect(() => {
    setBirthdayMessage(null);
    setBirthdayError(null);
  }, [currentCustomer?.id]);


  if (!currentCustomer) {
    if (!loadTimeout) return <LoadingScreen variant="customer" />;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-cozy-bg)] p-6 text-center">
        <img src="/cozylogo.png" alt="Cozy Moments" className="w-20 h-20 object-contain mb-6 opacity-60" />
        <p className="text-[var(--color-cozy-text)] font-serif text-lg mb-4">
          Er ging iets mis bij het laden van je profiel.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-white border border-gray-200 rounded-full py-3 px-8 font-medium text-[var(--color-cozy-text)] shadow-sm mb-3"
        >
          Opnieuw proberen
        </button>
        <button
          onClick={logout}
          className="text-gray-400 text-sm underline"
        >
          Uitloggen
        </button>
      </div>
    );
  }

  const totalRewards = (currentCustomer.rewards?.coffee || 0) + (currentCustomer.rewards?.wine || 0) + (currentCustomer.rewards?.beer || 0) + (currentCustomer.rewards?.soda || 0);
  const loyaltyConfig = LOYALTY_TIER_CONFIG[currentCustomer.loyaltyTier];
  const loyaltyProgress = getLoyaltyProgress(currentCustomer.loyaltyPoints);
  const nextTierLabel = loyaltyProgress.nextTier ? LOYALTY_TIER_CONFIG[loyaltyProgress.nextTier].label : null;
  const memberSince = new Intl.DateTimeFormat('nl-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(currentCustomer.createdAt));
  const lastVisitDateLabel = currentCustomer.lastVisitAt
    ? new Intl.DateTimeFormat('nl-BE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(currentCustomer.lastVisitAt))
    : 'Nog geen bezoek';
  const lastVisitSummary = (() => {
    if (!currentCustomer.lastVisitAt) return 'Nog geen bezoek geregistreerd';

    const visitDate = new Date(currentCustomer.lastVisitAt);
    const diffMs = Date.now() - visitDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

    if (diffDays === 0) return 'Vandaag';
    if (diffDays === 1) return 'Gisteren';
    return `${diffDays} dagen geleden`;
  })();
  const closeProfileSheet = () => {
    setShowProfileSheet(false);
    setShowLogoutConfirm(false);
  };
  const contactLabel = getCustomerContactLabel(
    currentCustomer.email,
    currentCustomer.loginAlias,
    currentCustomer.loginEmail,
  );
  const birthdayLabel = formatCustomerBirthdays(currentCustomer);
  const hasPartnerDraft = showPartnerBirthday
    || Boolean(birthdayDraft.partnerFirstName.trim() || birthdayDraft.partnerDay.trim() || birthdayDraft.partnerMonth.trim() || birthdayDraft.partnerYear.trim());
  const shouldSubmitPartnerBirthday = hasPartnerDraft || Boolean(currentCustomer.partnerFirstName);
  const pushPermissionLabel = pushState.permission === 'default'
    ? 'nog niet gevraagd'
    : pushState.permission === 'granted'
      ? 'toegestaan'
      : pushState.permission === 'denied'
        ? 'geblokkeerd'
        : 'niet ondersteund';

  const requestLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    setShowProfileSheet(false);
    logout();
  };

  const refreshPushState = async () => {
    if (!currentCustomer) return;
    const nextState = await fetchCustomerPushState(currentCustomer);
    setPushState(nextState);
  };

  const handleEnablePush = async () => {
    if (!currentCustomer) return;

    setPushBusy(true);
    setPushError(null);
    setPushMessage(null);

    try {
      const result = await subscribeCustomerToPush(currentCustomer);
      setPushState((current) => ({
        ...current,
        permission: 'granted',
        preferences: result.preferences ?? current.preferences,
        subscription: result.subscription ?? current.subscription,
      }));
      setPushMessage('Meldingen staan aan voor dit toestel.');
      await refreshPushState();
    } catch (error: any) {
      setPushError(error?.message || 'Meldingen inschakelen mislukte.');
      await refreshPushState().catch(() => undefined);
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    if (!currentCustomer) return;

    setPushBusy(true);
    setPushError(null);
    setPushMessage(null);

    try {
      const preferences = await unsubscribeCustomerFromPush(currentCustomer.id);
      setPushState((current) => ({ ...current, preferences, subscription: null }));
      setPushMessage('Meldingen staan uit voor dit toestel.');
      await refreshPushState();
    } catch (error: any) {
      setPushError(error?.message || 'Meldingen uitschakelen mislukte.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleUpdatePushPreference = async (field: 'promoOptIn' | 'rewardOptIn' | 'reminderOptIn', value: boolean) => {
    if (!currentCustomer) return;

    setPushBusy(true);
    setPushError(null);
    setPushMessage(null);

    try {
      const preferences = await updateCustomerPushPreferences(currentCustomer.id, { [field]: value });
      setPushState((current) => ({ ...current, preferences }));
      setPushMessage('Meldingsvoorkeuren bijgewerkt.');
    } catch (error: any) {
      setPushError(error?.message || 'Voorkeur opslaan mislukte.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleBirthdaySave = async () => {
    if (!currentCustomer) return;

    setBirthdaySaving(true);
    setBirthdayMessage(null);
    setBirthdayError(null);

    try {
      const normalized = normalizeBirthdayInput({
        day: birthdayDraft.day.trim() ? Number(birthdayDraft.day) : null,
        month: birthdayDraft.month.trim() ? Number(birthdayDraft.month) : null,
        year: birthdayDraft.year.trim() ? Number(birthdayDraft.year) : null,
      });
      await updateCustomerBirthday(currentCustomer.id, normalized, shouldSubmitPartnerBirthday ? {
        firstName: birthdayDraft.partnerFirstName,
        birthday: {
          day: birthdayDraft.partnerDay.trim() ? Number(birthdayDraft.partnerDay) : null,
          month: birthdayDraft.partnerMonth.trim() ? Number(birthdayDraft.partnerMonth) : null,
          year: birthdayDraft.partnerYear.trim() ? Number(birthdayDraft.partnerYear) : null,
        },
      } : undefined);
      setBirthdayMessage('Verjaardag opgeslagen.');
    } catch (error: any) {
      setBirthdayError(error?.message || 'Verjaardag opslaan mislukt.');
    } finally {
      setBirthdaySaving(false);
    }
  };

  return (
    <div
      className="min-h-screen pb-32 bg-[var(--color-cozy-bg)]"
      style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Header — premium glassmorphism */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="sticky top-0 z-50 mb-4 px-4 py-2.5"
        style={{
          background: 'rgba(245,245,240,0.42)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          borderBottom: '1px solid rgba(255,255,255,0.45)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
          borderRadius: '0 0 26px 26px',
        }}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center">
            <button onClick={logout} className="p-2 text-gray-400 hover:text-gray-600 transition-colors" title="Uitloggen">
              <LogOut size={18} />
            </button>
          </div>
          <div className="flex items-center justify-center">
            <a href="https://cozy-moments-website.vercel.app/" target="_blank" rel="noopener noreferrer">
              <img src="/cozylogo.png" alt="COZY Moments" className="w-[60px] h-[60px] object-contain" />
            </a>
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowProfileSheet(true)}
              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              title={`${displayName} - ${loyaltyConfig.label}`}
              aria-label="Open accountinformatie"
            >
              {showProfilePhoto ? (
                <div
                  className="h-10 w-10 rounded-full p-[2px] shadow-sm transition-transform active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${loyaltyConfig.accentColor} 0%, rgba(255,255,255,0.95) 100%)` }}
                >
                  <img
                    src={profilePhoto}
                    alt={`Profielfoto van ${displayName}`}
                    className="h-full w-full rounded-full object-cover bg-white"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                </div>
              ) : (
                <div
                  className="min-w-10 h-10 rounded-full flex items-center justify-center px-2 text-[12px] font-bold shadow-sm transition-transform active:scale-95"
                  style={loyaltyConfig.customerBadgeStyle}
                >
                  {profileInitials}
                </div>
              )}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {showWelcome && (
            <motion.div
              initial={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="mt-2 overflow-hidden"
            >
              {justRegistered ? (
                <>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-base">🎉</span>
                    <p className="text-xs text-[var(--color-cozy-coffee)] font-semibold uppercase tracking-wider">Account aangemaakt!</p>
                  </div>
                  <h2 className="text-xl font-display font-bold text-[var(--color-cozy-text)]">
                    Welkom, {justRegistered}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">Je digitale spaarkaart is klaar. Veel plezier!</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Welkom terug,</p>
                  <h2 className="text-xl font-display font-bold text-[var(--color-cozy-text)]">
                    {displayName}
                  </h2>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Promo banner — rotates through active promos */}
      {promoMessages.length > 0 && (
        <div className="px-6 mb-4">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-[var(--color-cozy-olive)]/8 border border-[var(--color-cozy-olive)]/15 rounded-2xl px-4 py-3 flex items-start gap-2.5 overflow-hidden"
          >
            <Megaphone size={16} className="text-[var(--color-cozy-olive)] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0 relative">
              <AnimatePresence mode="wait">
                <motion.p
                  key={promoIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-[var(--color-cozy-text)]/80 leading-snug"
                >
                  {promoMessages[promoIndex]}
                </motion.p>
              </AnimatePresence>
              {promoMessages.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-2">
                  {promoMessages.map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block w-1.5 h-1.5 rounded-full transition-colors ${i === promoIndex ? 'bg-[var(--color-cozy-olive)]' : 'bg-[var(--color-cozy-olive)]/25'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Rewards banner */}
      {totalRewards > 0 && (
        <div className="px-6 mb-4">
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => navigate('/rewards')}
            className="w-full bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
          >
            <motion.div
              animate={{ scale: [1, 1.14, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="w-10 h-10 bg-[var(--color-cozy-olive)] rounded-full flex items-center justify-center flex-shrink-0"
            >
              <Gift size={20} className="text-white" />
            </motion.div>
            <div className="flex-1 text-left">
              <p className="font-display font-bold text-[var(--color-cozy-text)]">
                {totalRewards} gratis {totalRewards === 1 ? 'consumptie' : 'consumpties'}!
              </p>
              <p className="text-xs text-gray-500">Tik om je beloningen te bekijken</p>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </motion.button>
        </div>
      )}

      {/* Cards stacked vertically */}
      <main className="px-6 space-y-5">
        {CARD_TYPES.map((type, i) => {
          // Show gold bonus stamps at positions [0, 1] on the card that received the welcome bonus.
          // Disappears automatically once bonus_card_type is cleared (after first full cycle of that type).
          const isBonusCard = currentCustomer.bonusCardType === type;
          const bonusStillActive = isBonusCard && currentCustomer.cards[type] >= 2;
          return (
            <React.Fragment key={type}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.1 + i * 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <LoyaltyCard
                  type={type}
                  count={currentCustomer.cards[type]}
                  fromCount={fillFromCards?.[type]}
                  bonusStampPositions={bonusStillActive ? [0, 1] : undefined}
                />
              </motion.div>

              {i === 1 && (
                <motion.a
                  href="https://www.cozy-moments.be/menu"
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.1 + i * 0.12 + 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="block rounded-[28px] border border-white/70 bg-white/55 backdrop-blur-md px-5 py-4 shadow-[0_10px_30px_rgba(70,62,48,0.08)] active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-cozy-olive)]/12 flex items-center justify-center text-[var(--color-cozy-olive)] shrink-0">
                      <BookOpen size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 font-medium mb-1">Cozy Moments</p>
                      <h3 className="font-display font-bold text-[var(--color-cozy-text)] text-lg leading-tight">Menukaart bekijken</h3>
                      <p className="text-sm text-gray-500 mt-1">Open het menu en bekijk het actuele aanbod.</p>
                    </div>
                    <ChevronRight size={20} className="text-gray-400 shrink-0" />
                  </div>
                </motion.a>
              )}
            </React.Fragment>
          );
        })}
      </main>

      {/* Scan button */}
      <div
        className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--color-cozy-bg)] via-[var(--color-cozy-bg)] to-transparent z-20 pointer-events-none"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          onClick={() => navigate('/scanner')}
          className="w-full bg-white/60 backdrop-blur-md border border-white/80 text-[var(--color-cozy-text)] rounded-full py-4 px-6 shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all pointer-events-auto"
        >
          <QrCode size={22} className="opacity-70" />
          <span className="font-display font-bold text-lg tracking-wide">Scan QR Code</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {showProfileSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
            style={{
              paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
            }}
            onClick={closeProfileSheet}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="bg-white w-full sm:max-w-lg rounded-[32px] max-h-[calc(100dvh-24px)] sm:max-h-[92vh] overflow-hidden shadow-2xl"
              style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 24px)' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative overflow-hidden px-5 sm:px-6 pt-5 sm:pt-6 pb-5 border-b border-white/70"
                style={{
                  background: `linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(245,249,255,0.96) 45%, ${currentCustomer.loyaltyTier === 'vip' ? 'rgba(203,223,255,0.92)' : 'rgba(248,245,239,0.96)'} 100%)`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[11px] font-medium tracking-[0.24em] uppercase text-[var(--color-cozy-text)]/45 mb-2">Mijn account</p>
                    <h2 className="font-display font-bold text-2xl text-[var(--color-cozy-text)] leading-tight">{displayName}</h2>
                    <p className="text-sm text-[var(--color-cozy-text)]/60 mt-1">Je account, punten en spaarkaartgegevens in één overzicht.</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeProfileSheet}
                    className="w-10 h-10 rounded-full bg-white/85 border border-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shrink-0"
                    aria-label="Sluit accountinformatie"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 flex items-center gap-4">
                  {showProfilePhoto ? (
                    <div className="h-16 w-16 rounded-full p-[3px] shadow-sm" style={{ background: loyaltyConfig.customerBadgeStyle.background }}>
                      <img
                        src={profilePhoto}
                        alt={`Profielfoto van ${displayName}`}
                        className="h-full w-full rounded-full object-cover bg-white"
                        onError={() => setAvatarLoadFailed(true)}
                      />
                    </div>
                  ) : (
                    <div className="min-w-16 h-16 rounded-full flex items-center justify-center px-3 text-lg font-bold shadow-sm" style={loyaltyConfig.customerBadgeStyle}>
                      {profileInitials}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border" style={{
                      background: loyaltyConfig.customerBadgeStyle.background,
                      color: loyaltyConfig.customerBadgeStyle.color,
                      border: loyaltyConfig.customerBadgeStyle.border,
                      boxShadow: loyaltyConfig.customerBadgeStyle.boxShadow,
                    }}>
                      <Award size={13} />
                      Status {loyaltyConfig.label}
                    </div>
                    <p className="text-sm text-[var(--color-cozy-text)] mt-2 font-medium">{currentCustomer.loyaltyPoints} punten op je account</p>
                    <p className="text-xs text-[var(--color-cozy-text)]/55 mt-1">Lid sinds {memberSince}</p>
                  </div>
                </div>
              </div>

              <div
                className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5 max-h-[calc(100dvh-250px)] sm:max-h-[calc(92vh-230px)]"
                style={{
                  maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 250px)',
                  paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-gray-100 bg-[#f8f8f5] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                      <Award size={16} />
                      <span className="text-xs font-medium uppercase tracking-wide">Huidige status</span>
                    </div>
                    <p className="font-display font-bold text-lg text-[var(--color-cozy-text)]">{loyaltyConfig.label}</p>
                    <p className="text-xs text-gray-500 mt-1">Vanaf {loyaltyConfig.minPoints} punten</p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-[#f8f8f5] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                      <Gift size={16} />
                      <span className="text-xs font-medium uppercase tracking-wide">Beschikbaar</span>
                    </div>
                    <p className="font-display font-bold text-lg text-[var(--color-cozy-text)]">
                      {totalRewards} gratis {totalRewards === 1 ? 'consumptie' : 'consumpties'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{totalRewards > 0 ? 'Klaar om te gebruiken aan de kassa' : 'Nog geen beloningen beschikbaar'}</p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-[#f8f8f5] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                      <CalendarDays size={16} />
                      <span className="text-xs font-medium uppercase tracking-wide">Recent bezoek</span>
                    </div>
                    <p className="font-display font-bold text-lg text-[var(--color-cozy-text)]">{lastVisitSummary}</p>
                    <p className="text-xs text-gray-500 mt-1">{lastVisitDateLabel}</p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-[#f8f8f5] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                      <CalendarDays size={16} />
                      <span className="text-xs font-medium uppercase tracking-wide">Totaal bezoeken</span>
                    </div>
                    <p className="font-display font-bold text-lg text-[var(--color-cozy-text)]">{currentCustomer.totalVisits}</p>
                    <p className="text-xs text-gray-500 mt-1">Totaal aantal geregistreerde bezoeken.</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-gray-100 bg-white shadow-sm px-4 py-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-medium text-[var(--color-cozy-text)]">Voortgang naar volgende status</span>
                    <span className="text-xs text-gray-500">
                      {nextTierLabel ? `${loyaltyProgress.progressPercent}% naar ${nextTierLabel}` : 'Hoogste status bereikt'}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-[#edf1f6] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${loyaltyProgress.progressPercent}%`,
                        background: nextTierLabel
                          ? `linear-gradient(90deg, ${loyaltyConfig.accentColor}, ${LOYALTY_TIER_CONFIG[loyaltyProgress.nextTier].accentColor})`
                          : loyaltyConfig.customerBadgeStyle.background,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {nextTierLabel
                      ? `${currentCustomer.loyaltyPoints} punten geregistreerd. Nog ${loyaltyProgress.pointsNeeded} punten tot ${nextTierLabel}.`
                      : 'Je account zit momenteel op de hoogste status.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-gray-100 bg-[#f8f8f5] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                      <Mail size={16} />
                      <span className="text-xs font-medium uppercase tracking-wide">Account</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-cozy-text)] break-all">{contactLabel}</p>
                    <p className="text-xs text-gray-500 mt-1">Hiermee is je spaarkaart gekoppeld.</p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-[#f8f8f5] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                      <CalendarDays size={16} />
                      <span className="text-xs font-medium uppercase tracking-wide">Klant sinds</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-cozy-text)]">{memberSince}</p>
                    <p className="text-xs text-gray-500 mt-1">Je account werd toen voor het eerst geregistreerd.</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-gray-100 bg-white shadow-sm px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                        <CalendarDays size={16} />
                        <span className="text-xs font-medium uppercase tracking-wide">Verjaardagen</span>
                      </div>
                      <h3 className="font-display font-bold text-[var(--color-cozy-text)]">{birthdayLabel}</h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Dag en maand zijn genoeg. Een tweede verjaardag kan onderaan toegevoegd worden.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      inputMode="numeric"
                      value={birthdayDraft.day}
                      onChange={(event) => setBirthdayDraft((current) => ({ ...current, day: event.target.value }))}
                      placeholder="Dag"
                      className="w-full rounded-2xl border border-gray-200 bg-[#f8f8f5] px-3 py-3 text-sm font-medium text-[var(--color-cozy-text)] outline-none focus:border-[var(--color-cozy-olive)]"
                    />
                    <input
                      type="number"
                      min="1"
                      max="12"
                      inputMode="numeric"
                      value={birthdayDraft.month}
                      onChange={(event) => setBirthdayDraft((current) => ({ ...current, month: event.target.value }))}
                      placeholder="Maand"
                      className="w-full rounded-2xl border border-gray-200 bg-[#f8f8f5] px-3 py-3 text-sm font-medium text-[var(--color-cozy-text)] outline-none focus:border-[var(--color-cozy-olive)]"
                    />
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      inputMode="numeric"
                      value={birthdayDraft.year}
                      onChange={(event) => setBirthdayDraft((current) => ({ ...current, year: event.target.value }))}
                      placeholder="Jaar"
                      className="w-full rounded-2xl border border-gray-200 bg-[#f8f8f5] px-3 py-3 text-sm font-medium text-[var(--color-cozy-text)] outline-none focus:border-[var(--color-cozy-olive)]"
                    />
                  </div>

                  {showPartnerBirthday ? (
                    <div className="mt-4 rounded-2xl border border-[#e8dcc8] bg-[#f8f8f5] px-3 py-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-cozy-olive)]">Partner</p>
                          <p className="text-xs text-gray-500">Alleen voor gedeelde accounts.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBirthdayDraft((current) => ({ ...current, partnerFirstName: '', partnerDay: '', partnerMonth: '', partnerYear: '' }));
                            setBirthdayError(null);
                            setBirthdayMessage(null);
                            setShowPartnerBirthday(false);
                          }}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-white"
                        >
                          Verwijderen
                        </button>
                      </div>
                      <input
                        type="text"
                        value={birthdayDraft.partnerFirstName}
                        onChange={(event) => setBirthdayDraft((current) => ({ ...current, partnerFirstName: event.target.value }))}
                        placeholder="Voornaam partner"
                        autoComplete="given-name"
                        className="mb-3 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-[var(--color-cozy-text)] outline-none focus:border-[var(--color-cozy-olive)]"
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          type="number"
                          min="1"
                          max="31"
                          inputMode="numeric"
                          value={birthdayDraft.partnerDay}
                          onChange={(event) => setBirthdayDraft((current) => ({ ...current, partnerDay: event.target.value }))}
                          placeholder="Dag"
                          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-[var(--color-cozy-text)] outline-none focus:border-[var(--color-cozy-olive)]"
                        />
                        <input
                          type="number"
                          min="1"
                          max="12"
                          inputMode="numeric"
                          value={birthdayDraft.partnerMonth}
                          onChange={(event) => setBirthdayDraft((current) => ({ ...current, partnerMonth: event.target.value }))}
                          placeholder="Maand"
                          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-[var(--color-cozy-text)] outline-none focus:border-[var(--color-cozy-olive)]"
                        />
                        <input
                          type="number"
                          min="1900"
                          max={new Date().getFullYear()}
                          inputMode="numeric"
                          value={birthdayDraft.partnerYear}
                          onChange={(event) => setBirthdayDraft((current) => ({ ...current, partnerYear: event.target.value }))}
                          placeholder="Jaar"
                          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-[var(--color-cozy-text)] outline-none focus:border-[var(--color-cozy-olive)]"
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowPartnerBirthday(true)}
                      className="mt-4 inline-flex min-h-10 items-center justify-center rounded-2xl border border-gray-200 bg-[#f8f8f5] px-4 text-sm font-semibold text-[var(--color-cozy-text)] transition-colors hover:bg-white"
                    >
                      Partner toevoegen
                    </button>
                  )}

                  {birthdayError && (
                    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700 leading-relaxed">
                      {birthdayError}
                    </div>
                  )}

                  {birthdayMessage && (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 leading-relaxed">
                      {birthdayMessage}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleBirthdaySave}
                    disabled={birthdaySaving}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[var(--color-cozy-text)] px-4 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {birthdaySaving ? 'Opslaan...' : 'Verjaardag opslaan'}
                  </button>
                </div>

                <div className="rounded-[24px] border border-gray-100 bg-white shadow-sm px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                        {pushState.preferences?.pushEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                        <span className="text-xs font-medium uppercase tracking-wide">Meldingen</span>
                      </div>
                      <h3 className="font-display font-bold text-[var(--color-cozy-text)]">Cozy pushmeldingen</h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Alleen voor beloningen, rustige herinneringen en relevante Cozy acties waar je zelf toestemming voor geeft.
                      </p>
                    </div>
                    <div className="shrink-0 rounded-full bg-[#f8f8f5] border border-gray-100 p-2 text-[var(--color-cozy-olive)]">
                      <Smartphone size={18} />
                    </div>
                  </div>

                  {!pushState.preferences?.pushEnabled && pushState.unavailableMessage && (
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed">
                      {pushState.unavailableMessage}
                    </div>
                  )}

                  {pushError && (
                    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700 leading-relaxed">
                      {pushError}
                    </div>
                  )}

                  {pushMessage && (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 leading-relaxed">
                      {pushMessage}
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-gray-500">
                      Status: {pushState.preferences?.pushEnabled ? 'aan' : 'uit'} · Toestemming: {pushPermissionLabel}
                    </div>
                    {pushState.preferences?.pushEnabled ? (
                      <button
                        type="button"
                        onClick={handleDisablePush}
                        disabled={pushBusy}
                        className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--color-cozy-text)] shadow-sm disabled:opacity-60"
                      >
                        Uitschakelen
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEnablePush}
                        disabled={pushBusy}
                        className="rounded-full bg-[var(--color-cozy-text)] px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                      >
                        {pushBusy ? 'Even geduld...' : 'Notificaties aanzetten'}
                      </button>
                    )}
                  </div>

                  {pushState.preferences?.pushEnabled && (
                    <div className="mt-4 grid gap-2">
                      {([
                        ['rewardOptIn', 'Beloningen en spaarkaart updates'],
                        ['reminderOptIn', 'Rustige herinneringen'],
                        ['promoOptIn', 'Promoties en tijdelijke acties'],
                      ] as const).map(([field, label]) => (
                        <label key={field} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-[#f8f8f5] px-4 py-3 text-sm text-[var(--color-cozy-text)]">
                          <span>{label}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(pushState.preferences?.[field])}
                            disabled={pushBusy}
                            onChange={(event) => handleUpdatePushPreference(field, event.target.checked)}
                            className="h-5 w-5 accent-[var(--color-cozy-olive)]"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-gray-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7f9fc_100%)] px-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Award size={16} className="text-[var(--color-cozy-olive)]" />
                    <h3 className="font-display font-bold text-[var(--color-cozy-text)]">Statusoverzicht</h3>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-3">
                    Je status wordt automatisch bepaald op basis van je totale spaarkaartactiviteit. Hieronder zie je vanaf hoeveel punten elke status geldt.
                  </p>
                  <div className="space-y-2">
                    {LOYALTY_TIER_ORDER.map((tier) => {
                      const config = LOYALTY_TIER_CONFIG[tier];
                      const isActiveTier = tier === currentCustomer.loyaltyTier;
                      const isNextTier = tier === loyaltyProgress.nextTier;
                      const isReachedTier = currentCustomer.loyaltyPoints >= config.minPoints;
                      let statusToneClass = 'text-gray-400';
                      let statusLabel = 'Beschikbaar vanaf deze grens';

                      if (isActiveTier) {
                        statusToneClass = 'opacity-80';
                        statusLabel = 'Actueel';
                      } else if (isNextTier) {
                        statusToneClass = 'text-[var(--color-cozy-text)]';
                        statusLabel = 'Volgende';
                      } else if (isReachedTier) {
                        statusLabel = 'Behaald';
                      }

                      return (
                        <div
                          key={tier}
                          className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 border"
                          style={isActiveTier ? {
                            background: config.customerBadgeStyle.background,
                            color: config.customerBadgeStyle.color,
                            border: config.customerBadgeStyle.border,
                            boxShadow: config.customerBadgeStyle.boxShadow,
                          } : undefined}
                        >
                          <div>
                            <p className="text-sm font-semibold">{config.label}</p>
                            <p className={`text-xs ${isActiveTier ? 'opacity-75' : 'text-gray-500'}`}>Vanaf {config.minPoints} punten</p>
                          </div>
                          <span className={`text-[11px] font-medium ${statusToneClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={requestLogout}
                  className="w-full rounded-full border border-[rgba(148,53,53,0.28)] bg-[rgba(176,72,72,0.5)] py-3.5 px-6 text-sm font-medium text-white shadow-[0_10px_24px_rgba(120,40,40,0.14)] backdrop-blur-sm transition-all active:scale-[0.98]"
                >
                  Uitloggen
                </button>
              </div>

              <AnimatePresence>
                {showLogoutConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 bg-[rgba(32,24,20,0.34)] backdrop-blur-[3px] flex items-center justify-center p-4"
                    onClick={() => setShowLogoutConfirm(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="w-full max-w-sm rounded-[28px] border border-white/70 bg-white/96 px-5 py-5 shadow-2xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="w-11 h-11 rounded-full bg-[rgba(176,72,72,0.12)] text-[#a84f4f] flex items-center justify-center mb-4">
                        <TriangleAlert size={20} />
                      </div>
                      <h3 className="font-display font-bold text-lg text-[var(--color-cozy-text)]">Ben je zeker?</h3>
                      <p className="text-sm text-gray-500 leading-relaxed mt-2">
                        Je wordt uitgelogd uit je klantenkaart en moet daarna opnieuw aanmelden om je account te openen.
                      </p>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setShowLogoutConfirm(false)}
                          className="rounded-full border border-gray-200 bg-[#f7f6f2] py-3 px-4 text-sm font-medium text-[var(--color-cozy-text)] transition-all active:scale-[0.98]"
                        >
                          Annuleren
                        </button>
                        <button
                          type="button"
                          onClick={confirmLogout}
                          className="rounded-full border border-[rgba(148,53,53,0.28)] bg-[rgba(176,72,72,0.5)] py-3 px-4 text-sm font-medium text-white shadow-[0_10px_24px_rgba(120,40,40,0.14)] backdrop-blur-sm transition-all active:scale-[0.98]"
                        >
                          Ja, uitloggen
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
