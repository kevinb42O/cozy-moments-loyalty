import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, LogOut, Gift, ChevronRight } from 'lucide-react';
import { useLoyalty } from '../../shared/store/LoyaltyContext';
import { useAuth } from '../../shared/store/AuthContext';
import { LoyaltyCard } from '../../shared/components/LoyaltyCard';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="min-h-screen pb-24 bg-[var(--color-cozy-bg)]">
      <header className="bg-white px-5 py-4 rounded-b-[32px] shadow-sm mb-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={logout} className="p-2 -ml-2 text-gray-400 hover:text-gray-600" title="Uitloggen">
            <LogOut size={20} />
          </button>
          <a href="https://www.cozy-moments.be/" target="_blank" rel="noopener noreferrer">
            <img src="/cozylogo.png" alt="COZY Moments" className="w-20 h-20 object-contain -my-2" />
          </a>
          <div className="w-9 h-9 bg-[#e8dcc8] rounded-full flex items-center justify-center text-[var(--color-cozy-coffee)] font-serif font-bold text-base">
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
      </header>

      {totalRewards > 0 && (
        <div className="px-6 mb-2">
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/rewards')}
            className="w-full bg-[var(--color-cozy-olive)]/10 border border-[var(--color-cozy-olive)]/20 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
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

      <main className="px-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <LoyaltyCard type="coffee" count={currentCustomer.cards.coffee} />
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <LoyaltyCard type="wine" count={currentCustomer.cards.wine} />
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <LoyaltyCard type="beer" count={currentCustomer.cards.beer} />
        </motion.div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--color-cozy-bg)] via-[var(--color-cozy-bg)] to-transparent">
        <button
          onClick={() => navigate('/scanner')}
          className="w-full bg-white/60 backdrop-blur-md border border-white/80 text-[var(--color-cozy-text)] rounded-full py-4 px-6 shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
        >
          <QrCode size={22} className="opacity-70" />
          <span className="font-display font-bold text-lg tracking-wide">Scan QR Code</span>
        </button>
      </div>
    </div>
  );
};
