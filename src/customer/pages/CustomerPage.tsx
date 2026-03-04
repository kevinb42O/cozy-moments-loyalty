import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, LogOut, Gift, ChevronRight } from 'lucide-react';
import { useLoyalty, CardType } from '../../shared/store/LoyaltyContext';
import { useAuth } from '../../shared/store/AuthContext';
import { LoyaltyCard } from '../../shared/components/LoyaltyCard';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';

const CARD_TYPES: CardType[] = ['coffee', 'wine', 'beer'];
const CARD_GAP = 14;

export const CustomerPage: React.FC = () => {
  const { currentCustomer } = useLoyalty();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const dragX = useMotionValue(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setShowWelcome(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Measure container width & calculate available card height
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
      // Calculate: full viewport - header - dots - bottom bar - small gaps
      const headerH = headerRef.current?.offsetHeight || 80;
      const dotsH = 36;
      const bottomBarH = 90;
      const gaps = 24;
      setCardHeight(window.innerHeight - headerH - dotsH - bottomBarH - gaps);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  if (!currentCustomer) return <div>Laden...</div>;

  const displayName = user?.name || currentCustomer.name;
  const totalRewards = (currentCustomer.rewards?.coffee || 0) + (currentCustomer.rewards?.wine || 0) + (currentCustomer.rewards?.beer || 0);

  const sidePadding = 16;
  const cardWidth = containerWidth - sidePadding * 2;
  const snapWidth = cardWidth + CARD_GAP;

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = cardWidth * 0.08;
    let newIndex = activeIndex;

    if (info.offset.x < -threshold || info.velocity.x < -200) {
      newIndex = Math.min(activeIndex + 1, CARD_TYPES.length - 1);
    } else if (info.offset.x > threshold || info.velocity.x > 200) {
      newIndex = Math.max(activeIndex - 1, 0);
    }

    setActiveIndex(newIndex);
    animate(dragX, -newIndex * snapWidth, {
      type: 'spring' as const,
      stiffness: 300,
      damping: 30,
    });
  };

  const goToCard = (index: number) => {
    setActiveIndex(index);
    animate(dragX, -index * snapWidth, {
      type: 'spring' as const,
      stiffness: 300,
      damping: 30,
    });
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[var(--color-cozy-bg)]">
      {/* Compact Header */}
      <motion.header
        ref={headerRef}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="bg-white/70 backdrop-blur-xl px-5 py-2 shadow-[0_2px_20px_rgba(0,0,0,0.05)] z-10 flex-shrink-0"
      >
        <div className="flex items-center justify-between">
          <button onClick={logout} className="p-2 -ml-2 text-gray-400 hover:text-gray-600 transition-colors" title="Uitloggen">
            <LogOut size={18} />
          </button>
          <a href="https://www.cozy-moments.be/" target="_blank" rel="noopener noreferrer">
            <img src="/cozylogo.png" alt="COZY Moments" className="w-14 h-14 object-contain" />
          </a>
          {totalRewards > 0 ? (
            <button
              onClick={() => navigate('/rewards')}
              className="relative p-2 -mr-2 text-[var(--color-cozy-olive)] hover:text-[var(--color-cozy-text)] transition-colors"
            >
              <Gift size={20} />
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[var(--color-cozy-olive)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {totalRewards}
              </span>
            </button>
          ) : (
            <div className="w-9 h-9 bg-[#e8dcc8] rounded-full flex items-center justify-center text-[var(--color-cozy-coffee)] font-serif font-bold text-sm shadow-sm">
              {displayName.charAt(0)}
            </div>
          )}
        </div>
      </motion.header>

      {/* Card carousel — fills remaining space */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden mt-2">
        <motion.div
          className="flex h-full cursor-grab active:cursor-grabbing touch-pan-y"
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
          dragElastic={0.15}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
        >
          {CARD_TYPES.map((type, i) => (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.08 + i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex-shrink-0 h-full"
              style={{ width: cardWidth }}
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

      {/* Bottom bar: dots + scan button */}
      <div className="flex-shrink-0 pb-[env(safe-area-inset-bottom)] bg-[var(--color-cozy-bg)]">
        {/* Pagination dots */}
        <div className="flex justify-center gap-2 py-2.5">
          {CARD_TYPES.map((type, i) => (
            <button
              key={type}
              onClick={() => goToCard(i)}
              className="p-1"
              aria-label={`Kaart ${i + 1}`}
            >
              <motion.div
                animate={{
                  width: i === activeIndex ? 24 : 8,
                  backgroundColor: i === activeIndex ? 'var(--color-cozy-olive)' : '#d1d5db',
                }}
                transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
                className="h-2 rounded-full"
              />
            </button>
          ))}
        </div>

        {/* Scan button */}
        <div className="px-5 pb-4">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            onClick={() => navigate('/scanner')}
            className="w-full bg-white/60 backdrop-blur-md border border-white/80 text-[var(--color-cozy-text)] rounded-full py-3.5 px-6 shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
          >
            <QrCode size={20} className="opacity-70" />
            <span className="font-display font-bold text-base tracking-wide">Scan QR Code</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};
