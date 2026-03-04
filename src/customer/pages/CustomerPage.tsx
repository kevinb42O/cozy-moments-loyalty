import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, LogOut, Gift, ChevronRight } from 'lucide-react';
import { useLoyalty, CardType } from '../../shared/store/LoyaltyContext';
import { useAuth } from '../../shared/store/AuthContext';
import { LoyaltyCard } from '../../shared/components/LoyaltyCard';
import { motion, AnimatePresence } from 'framer-motion';

const CARD_TYPES: CardType[] = ['coffee', 'wine', 'beer'];

export const CustomerPage: React.FC = () => {
  const { currentCustomer } = useLoyalty();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowWelcome(false), 5000);
    return () => clearTimeout(t);
  }, []);

  if (!currentCustomer) return <div>Laden...</div>;

  const displayName = user?.name || currentCustomer.name;
  const totalRewards = (currentCustomer.rewards?.coffee || 0) + (currentCustomer.rewards?.wine || 0) + (currentCustomer.rewards?.beer || 0);

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
          backdropFilter: 'blur(48px) saturate(200%)',
          WebkitBackdropFilter: 'blur(48px) saturate(200%)',
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
              animate={{ scale: [1, 1.18, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
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
        {CARD_TYPES.map((type, i) => (
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
            <LoyaltyCard type={type} count={currentCustomer.cards[type]} />
          </motion.div>
        ))}
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
