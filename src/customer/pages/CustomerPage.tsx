import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, LogOut, Gift, ChevronRight, Megaphone } from 'lucide-react';
import { useLoyalty, CardType } from '../../shared/store/LoyaltyContext';
import { useAuth } from '../../shared/store/AuthContext';
import { LoyaltyCard } from '../../shared/components/LoyaltyCard';
import { LoadingScreen } from '../../shared/components/LoadingScreen';
import { supabase } from '../../shared/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

const CARD_TYPES: CardType[] = ['coffee', 'wine', 'beer', 'soda'];

export const CustomerPage: React.FC = () => {
  const { currentCustomer } = useLoyalty();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [promoMessage, setPromoMessage] = useState('');

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

  const displayName = user?.name || currentCustomer.name;
  const totalRewards = (currentCustomer.rewards?.coffee || 0) + (currentCustomer.rewards?.wine || 0) + (currentCustomer.rewards?.beer || 0) + (currentCustomer.rewards?.soda || 0);

  return (
    <div className="min-h-screen pb-28 bg-[var(--color-cozy-bg)]">
      {/* Header — premium glassmorphism */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="sticky top-0 z-50 mb-5 px-5 py-4"
        style={{
          background: 'rgba(245,245,240,0.42)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          borderBottom: '1px solid rgba(255,255,255,0.45)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
          borderRadius: '0 0 32px 32px',
        }}
      >
        <div className="flex items-center justify-between">
          <button onClick={logout} className="p-2 -ml-2 text-gray-400 hover:text-gray-600 transition-colors" title="Uitloggen">
            <LogOut size={20} />
          </button>
          <a href="https://www.cozy-moments.be/" target="_blank" rel="noopener noreferrer">
            <img src="/cozylogo.png" alt="COZY Moments" className="w-20 h-20 object-contain -my-2" />
          </a>
          <div className="w-9 h-9 bg-[#e8dcc8] rounded-full flex items-center justify-center text-[var(--color-cozy-coffee)] font-serif font-bold text-base shadow-sm">
            {displayName.charAt(0)}
          </div>
        </div>
        <AnimatePresence>
          {showWelcome && (
            <motion.div
              initial={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="mt-4 overflow-hidden"
            >
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Welkom terug,</p>
              <h2 className="text-2xl font-display font-bold text-[var(--color-cozy-text)]">
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
            <div className="w-10 h-10 bg-[var(--color-cozy-olive)] rounded-full flex items-center justify-center flex-shrink-0">
              <Gift size={20} className="text-white" />
            </div>
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
