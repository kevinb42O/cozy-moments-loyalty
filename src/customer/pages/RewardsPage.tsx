import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coffee, Wine, Beer, Gift, Trophy, QrCode } from 'lucide-react';
import { useLoyalty, CardType, cardTypeLabels } from '../../shared/store/LoyaltyContext';
import { motion } from 'framer-motion';

const rewardConfig: Record<CardType, { icon: React.ElementType; bg: string; color: string; activeBg: string }> = {
  coffee: { icon: Coffee, bg: 'bg-[#e8dcc8]', color: 'text-[var(--color-cozy-coffee)]', activeBg: 'bg-[var(--color-cozy-coffee)]' },
  wine: { icon: Wine, bg: 'bg-[#f0d8dc]', color: 'text-[var(--color-cozy-wine)]', activeBg: 'bg-[var(--color-cozy-wine)]' },
  beer: { icon: Beer, bg: 'bg-[#fcf4d9]', color: 'text-[var(--color-cozy-beer)]', activeBg: 'bg-[var(--color-cozy-beer)]' },
};

export const RewardsPage: React.FC = () => {
  const { currentCustomer } = useLoyalty();
  const navigate = useNavigate();

  if (!currentCustomer) return null;

  const rewards = currentCustomer.rewards;
  const claimed = currentCustomer.claimedRewards;
  const totalRewards = rewards.coffee + rewards.wine + rewards.beer;

  return (
    <div className="min-h-screen pb-28 bg-[var(--color-cozy-bg)]">
      <header className="bg-white px-6 py-6 rounded-b-[40px] shadow-sm mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 text-gray-400 hover:text-gray-600">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[var(--color-cozy-text)]">
            Mijn Beloningen
          </h1>
        </div>
      </header>

      <main className="px-6 space-y-8">
        {/* Available Rewards */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Gift size={20} className="text-[var(--color-cozy-olive)]" />
            <h2 className="text-xl font-serif font-semibold text-[var(--color-cozy-text)]">
              Beschikbaar
            </h2>
          </div>

          {totalRewards === 0 ? (
            <div className="bg-white rounded-[24px] p-8 text-center shadow-sm">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift size={28} className="text-gray-400" />
              </div>
              <p className="text-gray-500 font-serif">Nog geen beloningen verdiend</p>
              <p className="text-sm text-gray-400 mt-1">Spaar 10 stempels voor een gratis consumptie!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(Object.keys(rewards) as CardType[]).map((type, i) => {
                const count = rewards[type];
                if (count <= 0) return null;
                const config = rewardConfig[type];
                const Icon = config.icon;

                return (
                  <motion.div
                    key={type}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white rounded-[24px] p-5 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${config.activeBg}`}>
                        <Icon size={28} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-serif font-semibold text-lg text-[var(--color-cozy-text)]">
                          Gratis {cardTypeLabels[type]}
                        </h3>
                        <p className="text-sm text-gray-500">Toon aan de kassa om in te wisselen</p>
                      </div>
                    </div>
                    <div className="bg-[var(--color-cozy-olive)] text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      {count}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* History / Stats */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={20} className="text-[var(--color-cozy-olive)]" />
            <h2 className="text-xl font-serif font-semibold text-[var(--color-cozy-text)]">
              Ingewisseld
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(claimed) as CardType[]).map((type) => {
              const config = rewardConfig[type];
              const Icon = config.icon;
              return (
                <div key={type} className="bg-white rounded-[20px] p-4 shadow-sm flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${config.bg}`}>
                    <Icon size={20} className={config.color} />
                  </div>
                  <span className="font-mono text-2xl font-bold text-[var(--color-cozy-text)]">{claimed[type]}</span>
                  <span className="text-xs text-gray-400 mt-1">ingewisseld</span>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Bottom CTA */}
      {totalRewards > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--color-cozy-bg)] via-[var(--color-cozy-bg)] to-transparent">
          <button
            onClick={() => navigate('/scanner')}
            className="w-full bg-white/60 backdrop-blur-md border border-white/80 text-[var(--color-cozy-text)] rounded-full py-4 px-6 shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
          >
            <QrCode size={22} className="opacity-70" />
            <span className="font-serif font-semibold text-lg tracking-wide">Scan om in te wisselen</span>
          </button>
        </div>
      )}
    </div>
  );
};
