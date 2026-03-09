import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, LogOut, Gift, ChevronRight, Megaphone } from 'lucide-react';
import { useLoyalty, CardType } from '../../shared/store/LoyaltyContext';
import { useAuth } from '../../shared/store/AuthContext';
import { LoyaltyCard } from '../../shared/components/LoyaltyCard';
import { LoadingScreen } from '../../shared/components/LoadingScreen';
import { supabase } from '../../shared/lib/supabase';
import { LOYALTY_TIER_CONFIG } from '../../shared/lib/loyalty-tier';
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
  const dashboardRef = useRef<HTMLDivElement | null>(null);

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

  /* ─── Liquid gyro / tilt engine ───
   *
   * Outputs two CSS custom properties on the dashboard container:
   *   --cozy-liquid-tilt-deg   → rotation of the liquid surface (max ±14deg)
   *   --cozy-liquid-shift-pct  → horizontal displacement of the surface (max ±18%)
   *
   * On Android the DeviceOrientationEvent fires automatically (no permission prompt).
   * On iOS 13+ we request permission on the first user gesture.
   * Desktop/fallback: pointer/touch position maps to tilt.
   */
  useEffect(() => {
    if (!dashboardRef.current) return;
    const host = dashboardRef.current;

    // Sane defaults — no movement
    host.style.setProperty('--cozy-liquid-tilt-deg', '0deg');
    host.style.setProperty('--cozy-liquid-shift-pct', '0%');

    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let active = true;
    let gyroActive = false;
    let rafId = 0;

    // Target = where sensor says we should be. Current = smoothed value.
    let targetTiltDeg = 0;   // rotation in degrees
    let targetShiftPct = 0;  // horizontal shift in %
    let currentTiltDeg = 0;
    let currentShiftPct = 0;

    // Smoothing factor — higher = snappier, lower = smoother. 0.08 is ~60fps smooth.
    const SMOOTHING = 0.1;

    // How much the liquid reacts: max 14° tilt, max 18% horizontal shift.
    const MAX_TILT_DEG = 14;
    const MAX_SHIFT_PCT = 18;

    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

    /* --- Gyroscope handler (Android + iOS) --- */
    const onOrientation = (e: DeviceOrientationEvent) => {
      // gamma = left/right tilt (-90..90).
      // Positive gamma = phone tilted right → liquid pools right → rotate clockwise.
      const gamma = typeof e.gamma === 'number' ? e.gamma : 0;

      // Map gamma of ±45° to max tilt/shift. Beyond 45° clamp.
      targetTiltDeg = clamp(gamma * (MAX_TILT_DEG / 45), -MAX_TILT_DEG, MAX_TILT_DEG);
      targetShiftPct = clamp(gamma * (MAX_SHIFT_PCT / 45), -MAX_SHIFT_PCT, MAX_SHIFT_PCT);
    };

    /* --- Pointer / touch fallback (desktop & when gyro unavailable) --- */
    const applyPointerTilt = (clientX: number, _clientY: number) => {
      if (gyroActive) return; // gyro takes priority
      const rect = host.getBoundingClientRect();
      if (!rect.width) return;
      // -1 (left edge) to +1 (right edge)
      const norm = clamp(((clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
      targetTiltDeg = norm * MAX_TILT_DEG * 0.7;
      targetShiftPct = norm * MAX_SHIFT_PCT * 0.7;
    };

    const onPointerMove = (e: PointerEvent) => applyPointerTilt(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) applyPointerTilt(t.clientX, t.clientY);
    };
    const resetTilt = () => { targetTiltDeg = 0; targetShiftPct = 0; };

    /* --- Start gyro listener --- */
    const startGyro = () => {
      if (gyroActive || !active) return;
      window.addEventListener('deviceorientation', onOrientation, true);
      gyroActive = true;
    };

    const requestGyroPermission = async () => {
      try {
        const Ctor = window.DeviceOrientationEvent as any;
        if (!Ctor) return;
        if (typeof Ctor.requestPermission === 'function') {
          // iOS 13+ — needs user gesture
          const perm = await Ctor.requestPermission();
          if (perm === 'granted') startGyro();
          return;
        }
        // Android / non-iOS — just start
        startGyro();
      } catch { /* silent fail */ }
    };

    // Try immediately (works on Android); iOS will catch up on gesture.
    void requestGyroPermission();

    const onGesture = () => void requestGyroPermission();
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('touchstart', onGesture, { passive: true });

    // Pointer/touch fallback listeners
    host.addEventListener('pointermove', onPointerMove, { passive: true });
    host.addEventListener('touchmove', onTouchMove, { passive: true });
    host.addEventListener('pointerleave', resetTilt, { passive: true });
    host.addEventListener('touchend', resetTilt, { passive: true });
    host.addEventListener('touchcancel', resetTilt, { passive: true });

    /* --- 60fps render loop --- */
    const tick = () => {
      if (!active) return;

      // Idle slosh — a gentle sine oscillation so liquid always looks alive.
      // When gyro is active the user's hand tremor already provides motion,
      // so we reduce the idle amount.
      const t = performance.now() / 1000;
      const idleFactor = gyroActive ? 0.25 : 1.0;
      const idleTilt = Math.sin(t * 1.1) * 2.2 * idleFactor;
      const idleShift = Math.sin(t * 0.85 + 0.7) * 2.8 * idleFactor;

      const goalTilt = targetTiltDeg + idleTilt;
      const goalShift = targetShiftPct + idleShift;

      currentTiltDeg += (goalTilt - currentTiltDeg) * SMOOTHING;
      currentShiftPct += (goalShift - currentShiftPct) * SMOOTHING;

      // Snap to zero when very small to avoid sub-pixel jitter
      const tilt = Math.abs(currentTiltDeg) < 0.05 ? 0 : currentTiltDeg;
      const shift = Math.abs(currentShiftPct) < 0.05 ? 0 : currentShiftPct;

      host.style.setProperty('--cozy-liquid-tilt-deg', `${tilt.toFixed(2)}deg`);
      host.style.setProperty('--cozy-liquid-shift-pct', `${shift.toFixed(2)}%`);

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      if (gyroActive) window.removeEventListener('deviceorientation', onOrientation, true);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('touchstart', onGesture);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('touchmove', onTouchMove);
      host.removeEventListener('pointerleave', resetTilt);
      host.removeEventListener('touchend', resetTilt);
      host.removeEventListener('touchcancel', resetTilt);
      host.style.setProperty('--cozy-liquid-tilt-deg', '0deg');
      host.style.setProperty('--cozy-liquid-shift-pct', '0%');
    };
  }, []);

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

  return (
    <div ref={dashboardRef} className="min-h-screen pb-28 bg-[var(--color-cozy-bg)]">
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
            {showProfilePhoto ? (
              <div
                className="h-10 w-10 rounded-full p-[2px] shadow-sm"
                style={{ background: loyaltyConfig.accentColor }}
                title={`${displayName} - ${loyaltyConfig.label}`}
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
                className="min-w-10 h-10 rounded-full flex items-center justify-center px-2 text-[12px] font-bold shadow-sm"
                style={loyaltyConfig.customerBadgeStyle}
                title={`${displayName} - ${loyaltyConfig.label}`}
              >
                {profileInitials}
              </div>
            )}
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
    </div>
  );
};
