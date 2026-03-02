import React from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, LogOut, Coffee, Gift, ChevronRight } from 'lucide-react';
import { useLoyalty } from '../../shared/store/LoyaltyContext';
import { useAuth } from '../../shared/store/AuthContext';
import { LoyaltyCard } from '../../shared/components/LoyaltyCard';
import { motion } from 'framer-motion';

export const CustomerPage: React.FC = () => {
  const { currentCustomer } = useLoyalty();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!currentCustomer) return <div>Laden...</div>;

  const displayName = user?.name || currentCustomer.name;
  const totalRewards = (currentCustomer.rewards?.coffee || 0) + (currentCustomer.rewards?.wine || 0) + (currentCustomer.rewards?.beer || 0);

  return (
    <div className="min-h-screen pb-24 bg-[var(--color-cozy-bg)]">
      <header className="bg-white px-6 py-8 rounded-b-[40px] shadow-sm mb-8 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={logout} className="p-2 -ml-2 text-gray-400 hover:text-gray-600" title="Uitloggen">
            <LogOut size={22} />
          </button>
          <div className="flex items-center gap-2 text-[var(--color-cozy-coffee)]">
            <Coffee size={24} />
            <h1 className="text-2xl font-serif font-bold tracking-tight">Cozy Moments</h1>
          </div>
          <div className="w-10 h-10 bg-[#e8dcc8] rounded-full flex items-center justify-center text-[var(--color-cozy-coffee)] font-serif font-bold text-lg">
            {displayName.charAt(0)}
          </div>
        </div>
        <div className="mt-8">
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Welkom terug,</p>
          <h2 className="text-3xl font-serif font-semibold text-[var(--color-cozy-text)]">
            {displayName}
          </h2>
        </div>
      </header>

      {totalRewards > 0 && (
        <div className="px-6 mb-2">
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/rewards')}
            className="w-full bg-[var(--color-cozy-olive)]/10 border border-[var(--color-cozy-olive)]/20 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 bg-[var(--color-cozy-olive)] rounded-full flex items-center justify-center flex-shrink-0">
              <Gift size={20} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-serif font-semibold text-[var(--color-cozy-text)]">
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
          className="w-full bg-[var(--color-cozy-olive)] text-white rounded-full py-4 px-6 shadow-lg flex items-center justify-center gap-3 hover:bg-[#4a4a34] transition-colors"
        >
          <QrCode size={24} />
          <span className="font-serif font-semibold text-lg tracking-wide">Scan QR Code</span>
        </button>
      </div>
    </div>
  );
};
