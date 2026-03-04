import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, LogOut, Gift, ChevronRight } from 'lucide-react';
import { useLoyalty, CardType } from '../../shared/store/LoyaltyContext';
import { useAuth } from '../../shared/store/AuthContext';
import { LoyaltyCard } from '../../shared/components/LoyaltyCard';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';

const CARD_TYPES: CardType[] = ['coffee', 'wine', 'beer'];
const CARD_GAP = 16; // px gap between cards

export const CustomerPage: React.FC = () => {
  const { currentCustomer } = useLoyalty();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setShowWelcome(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Measure container width for card sizing
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  if (!currentCustomer) return <div>Laden...</div>;

  const displayName = user?.name || currentCustomer.name;
  const totalRewards = (currentCustomer.rewards?.coffee || 0) + (currentCustomer.rewards?.wine || 0) + (currentCustomer.rewards?.beer || 0);

  // Card dimensions: show peek of next card
  const sidePadding = 24;
  const cardWidth = containerWidth - sidePadding * 2;
  const snapWidth = cardWidth + CARD_GAP;

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = cardWidth * 0.2;
    const velocity = info.velocity.x;
    let newIndex = activeIndex;

    if (info.offset.x < -threshold || velocity < -400) {
      newIndex = Math.min(activeIndex + 1, CARD_TYPES.length - 1);
    } else if (info.offset.x > threshold || velocity > 400) {
      newIndex = Math.max(activeIndex - 1, 0);
    }

    setActiveIndex(newIndex);
    animate(dragX, -newIndex * snapWidth, {
      type: 'spring',
      stiffness: 350,
      damping: 35,
    });
  };

  const goToCard = (index: number) => {
    setActiveIndex(index);
    animate(dragX, -index * snapWidth, {
      type: 'spring',
      stiffness: 350,
      damping: 35,
    });
  };

  return (
    <div className="min-h-screen pb-24 bg-[var(--color-cozy-bg)]">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white/70 backdrop-blur-xl px-5 py-4 rounded-b-[32px] shadow-[0_4px_30px_rgba(0,0,0,0.06)] mb-5 sticky top-0 z-10 border-b border-white/50"
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

      {/* Section title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="px-6 mb-3"
      >
        <h2 className="text-lg font-display font-bold text-[var(--color-cozy-text)]">
          Mijn Kaarten
        </h2>
      </motion.div>

      {/* Apple Wallet Carousel */}
      <div ref={containerRef} className="relative overflow-hidden">
        <motion.div
          className="flex cursor-grab active:cursor-grabbing"
          style={{
            x: dragX,
            paddingLeft: sidePadding,
            paddingRight: sidePadding,
            gap: `${CARD_GAP}px`,
          }}
          drag="x"
          dragConstraints={{
            left: -(CARD_TYPES.length - 1) * snapWidth,
            right: 0,
          }}
          dragElastic={0.12}
          onDragEnd={handleDragEnd}
        >
          {CARD_TYPES.map((type, i) => (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.1 + i * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex-shrink-0"
              style={{ width: cardWidth }}
              onTap={() => goToCard(i)}
            >
              <LoyaltyCard
                type={type}
                count={currentCustomer.cards[type]}
                isActive={i === activeIndex}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Pagination dots */}
      <div className="flex justify-center gap-2 mt-5">
        {CARD_TYPES.map((_, i) => (
          <button
            key={i}
            onClick={() => goToCard(i)}
            className="p-1"
            aria-label={`Kaart ${i + 1}`}
          >
            <motion.div
              animate={{
                width: i === activeIndex ? 24 : 8,
                backgroundColor: i === activeIndex ? 'var(--color-cozy-olive)' : '#d1d5db',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="h-2 rounded-full"
            />
          </button>
        ))}
      </div>

      {/* Scan button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--color-cozy-bg)] via-[var(--color-cozy-bg)] to-transparent">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          onClick={() => navigate('/scanner')}
          className="w-full bg-white/60 backdrop-blur-md border border-white/80 text-[var(--color-cozy-text)] rounded-full py-4 px-6 shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
        >
          <QrCode size={22} className="opacity-70" />
          <span className="font-display font-bold text-lg tracking-wide">Scan QR Code</span>
        </motion.button>
      </div>
    </div>
  );
};
