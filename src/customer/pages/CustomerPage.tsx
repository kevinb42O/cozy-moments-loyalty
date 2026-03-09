import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, LogOut, Gift, ChevronRight, Megaphone, X, Mail, Award, TrendingUp, CalendarDays, Crown } from 'lucide-react';
import { useLoyalty, CardType } from '../../shared/store/LoyaltyContext';
import { useAuth } from '../../shared/store/AuthContext';
import { LoyaltyCard } from '../../shared/components/LoyaltyCard';
import { LoadingScreen } from '../../shared/components/LoadingScreen';
import { supabase } from '../../shared/lib/supabase';
import { LOYALTY_TIER_CONFIG, LOYALTY_TIER_ORDER, getLoyaltyProgress } from '../../shared/lib/loyalty-tier';
import { motion, AnimatePresence } from 'framer-motion';

const CARD_TYPES: CardType[] = ['coffee', 'wine', 'beer', 'soda'];

export const CustomerPage: React.FC = () => {
  const { currentCustomer } = useLoyalty();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [promoMessage, setPromoMessage] = useState('');
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [fillFromCards, setFillFromCards] = useState<Partial<Record<CardType, number>> | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowWelcome(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Fetch promo message
  useEffect(() => {
    if (!supabase) return;

    const loadPromoMessage = async () => {
      const { data, error } = await supabase.from('site_settings').select('promo_message').eq('id', 'default').single();
      if (error) {
        console.error('Kon promo banner niet laden:', error);
        return;
      }
      setPromoMessage(data?.promo_message ?? '');
    };

    loadPromoMessage();

    const channel = supabase
      .channel('site-settings-realtime-customer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => {
        loadPromoMessage();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
  const lastVisitLabel = (() => {
    if (!currentCustomer.lastVisitAt) return 'Nog geen bezoek geregistreerd';

    const visitDate = new Date(currentCustomer.lastVisitAt);
    const diffMs = Date.now() - visitDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

    if (diffDays === 0) return 'Vandaag nog langs geweest';
    if (diffDays === 1) return 'Laatst gezien: gisteren';
    return `Laatst gezien: ${diffDays} dagen geleden`;
  })();

  return (
    <div className="min-h-screen pb-28 bg-[var(--color-cozy-bg)]">
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
            <a href="https://www.cozy-moments.be/" target="_blank" rel="noopener noreferrer">
              <img src="/cozylogo.png" alt="COZY Moments" className="w-[60px] h-[60px] object-contain" />
            </a>
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowProfileSheet(true)}
              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              title={`${displayName} - ${loyaltyConfig.label}`}
              aria-label="Open profielstatus"
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
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Welkom terug,</p>
              <h2 className="text-xl font-display font-bold text-[var(--color-cozy-text)]">
                {displayName}
              </h2>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Promo banner */}
      {promoMessage && (
        <div className="px-6 mb-4">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-[var(--color-cozy-olive)]/8 border border-[var(--color-cozy-olive)]/15 rounded-2xl px-4 py-3 flex items-start gap-2.5"
          >
            <Megaphone size={16} className="text-[var(--color-cozy-olive)] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-[var(--color-cozy-text)]/80 leading-snug">{promoMessage}</p>
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
            <motion.div
              key={type}
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
          );
        })}
      </main>

      {/* Scan button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--color-cozy-bg)] via-[var(--color-cozy-bg)] to-transparent z-20 pointer-events-none">
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
            className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={() => setShowProfileSheet(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] overflow-hidden shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative overflow-hidden px-5 sm:px-6 pt-5 sm:pt-6 pb-5 border-b border-white/70"
                style={{
                  background: `linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(245,249,255,0.96) 45%, ${currentCustomer.loyaltyTier === 'vip' ? 'rgba(203,223,255,0.92)' : 'rgba(248,245,239,0.96)'} 100%)`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[11px] font-medium tracking-[0.24em] uppercase text-[var(--color-cozy-text)]/45 mb-2">Profielstatus</p>
                    <h2 className="font-display font-bold text-2xl text-[var(--color-cozy-text)] leading-tight">{displayName}</h2>
                    <p className="text-sm text-[var(--color-cozy-text)]/60 mt-1">Alles over je loyalty-status op één plek.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProfileSheet(false)}
                    className="w-10 h-10 rounded-full bg-white/85 border border-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shrink-0"
                    aria-label="Sluit profielstatus"
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
                      <Crown size={13} />
                      {loyaltyConfig.label}
                    </div>
                    <p className="text-sm text-[var(--color-cozy-text)] mt-2 font-medium">{currentCustomer.loyaltyPoints} loyalty-punten</p>
                    <p className="text-xs text-[var(--color-cozy-text)]/55 mt-1">Lid sinds {memberSince}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5 max-h-[calc(92vh-180px)]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-gray-100 bg-[#f8f8f5] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                      <Award size={16} />
                      <span className="text-xs font-medium uppercase tracking-wide">Huidige tier</span>
                    </div>
                    <p className="font-display font-bold text-lg text-[var(--color-cozy-text)]">{loyaltyConfig.label}</p>
                    <p className="text-xs text-gray-500 mt-1">Vanaf {loyaltyConfig.minPoints} punten</p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-[#f8f8f5] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                      <TrendingUp size={16} />
                      <span className="text-xs font-medium uppercase tracking-wide">Volgende stap</span>
                    </div>
                    <p className="font-display font-bold text-lg text-[var(--color-cozy-text)]">
                      {nextTierLabel ? `Nog ${loyaltyProgress.pointsNeeded}` : 'Max bereikt'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{nextTierLabel ? `Tot ${nextTierLabel}` : 'Je zit op het hoogste level'}</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-gray-100 bg-white shadow-sm px-4 py-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-medium text-[var(--color-cozy-text)]">Voortgang naar volgende tier</span>
                    <span className="text-xs text-gray-500">
                      {nextTierLabel ? `${loyaltyProgress.progressPercent}% naar ${nextTierLabel}` : 'Hoogste tier bereikt'}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-[#edf1f6] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${loyaltyProgress.progressPercent}%`,
                        background: nextTierLabel
                          ? `linear-gradient(90deg, ${loyaltyConfig.accentColor}, ${LOYALTY_TIER_CONFIG[loyaltyProgress.nextTier!].accentColor})`
                          : loyaltyConfig.customerBadgeStyle.background,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {nextTierLabel
                      ? `${currentCustomer.loyaltyPoints} van ${loyaltyProgress.nextTierMinPoints} punten voor ${nextTierLabel}`
                      : 'Je hebt het hoogste loyalty-level bereikt.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-gray-100 bg-[#f8f8f5] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                      <Mail size={16} />
                      <span className="text-xs font-medium uppercase tracking-wide">Account</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-cozy-text)] break-all">{currentCustomer.email || 'Geen e-mailadres beschikbaar'}</p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-[#f8f8f5] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-cozy-olive)] mb-2">
                      <CalendarDays size={16} />
                      <span className="text-xs font-medium uppercase tracking-wide">Bezoeken</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-cozy-text)]">{currentCustomer.totalVisits} bezoeken</p>
                    <p className="text-xs text-gray-500 mt-1">{lastVisitLabel}</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-gray-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7f9fc_100%)] px-4 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown size={16} className="text-[var(--color-cozy-olive)]" />
                    <h3 className="font-display font-bold text-[var(--color-cozy-text)]">Levelvolgorde</h3>
                  </div>
                  <div className="space-y-2">
                    {LOYALTY_TIER_ORDER.map((tier) => {
                      const config = LOYALTY_TIER_CONFIG[tier];
                      const isActiveTier = tier === currentCustomer.loyaltyTier;
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
                          <span className={`text-[11px] font-medium ${isActiveTier ? 'opacity-80' : 'text-gray-400'}`}>
                            {isActiveTier ? 'Jouw level' : 'Nog niet bereikt'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
