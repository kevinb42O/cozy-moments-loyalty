import React from 'react';
import { Coffee, Wine, Beer, Check } from 'lucide-react';
import { CardType } from '../store/LoyaltyContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface LoyaltyCardProps {
  type: CardType;
  count: number;
  isActive?: boolean;
}

const cardConfig = {
  coffee: {
    title: 'Koffie',
    icon: Coffee,
    color: 'text-[var(--color-cozy-coffee)]',
    bg: 'bg-[#e8dcc8]',
    activeBg: 'bg-[var(--color-cozy-coffee)]',
    activeText: 'text-[#e8dcc8]',
    gradientFrom: '#5c4033',
    gradientTo: '#8b6b54',
    stampActiveBg: 'rgba(255,255,255,0.35)',
  },
  wine: {
    title: 'Wijn',
    icon: Wine,
    color: 'text-[var(--color-cozy-wine)]',
    bg: 'bg-[#f0d8dc]',
    activeBg: 'bg-[var(--color-cozy-wine)]',
    activeText: 'text-[#f0d8dc]',
    gradientFrom: '#722f37',
    gradientTo: '#a64d55',
    stampActiveBg: 'rgba(255,255,255,0.35)',
  },
  beer: {
    title: 'Bier',
    icon: Beer,
    color: 'text-[var(--color-cozy-beer)]',
    bg: 'bg-[#fcf4d9]',
    activeBg: 'bg-[var(--color-cozy-beer)]',
    activeText: 'text-[#fcf4d9]',
    gradientFrom: '#b8941e',
    gradientTo: '#d4af37',
    stampActiveBg: 'rgba(255,255,255,0.35)',
  },
};

function getMotivationText(count: number, type: string): string {
  const drinkMap: Record<string, string> = {
    coffee: 'koffietje',
    wine: 'wijntje',
    beer: 'biertje',
  };
  const drink = drinkMap[type] || 'consumptie';
  const emojiMap: Record<string, string> = {
    coffee: '☕',
    wine: '🍷',
    beer: '🍻',
  };
  const emoji = emojiMap[type] || '🎉';

  if (count === 0) return `Spaar 10 stempels voor een gratis ${drink}!`;
  if (count === 1) return `Goed begin! Nog 9 te gaan ${emoji}`;
  if (count <= 3) return `Lekker bezig! Nog ${10 - count} te gaan`;
  if (count <= 5) return `Halverwege! Nog ${10 - count} stempels ${emoji}`;
  if (count <= 7) return `Goed op weg! Nog maar ${10 - count}...`;
  if (count === 8) return `Bijna! Nog 2 voor een gratis ${drink}! ${emoji}`;
  if (count === 9) return `Oeh, nog eentje voor een gratis ${drink}! ${emoji}`;
  return `Gefeliciteerd! Je ${drink} is gratis! 🎉`;
}

const stampVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: (i: number) => ({
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 15,
      delay: 0.04 * i,
    },
  }),
};

const checkVariants = {
  hidden: { scale: 0, rotate: -45 },
  visible: (i: number) => ({
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 500,
      damping: 12,
      delay: 0.04 * i + 0.08,
    },
  }),
};

export const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ type, count, isActive = true }) => {
  const config = cardConfig[type];
  const Icon = config.icon;

  return (
    <div
      className="relative w-full h-full rounded-[28px] overflow-hidden select-none"
      style={{
        background: `linear-gradient(135deg, ${config.gradientFrom} 0%, ${config.gradientTo} 100%)`,
        boxShadow: isActive
          ? '0 20px 60px -12px rgba(0,0,0,0.3), 0 8px 20px -6px rgba(0,0,0,0.15)'
          : '0 8px 30px -8px rgba(0,0,0,0.12)',
      }}
    >
      {/* Glass overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.12) 100%)',
        }}
      />

      {/* Subtle dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, white 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Icon className="w-6 h-6 text-white/90" />
            </div>
            <div>
              <h3 className="text-xl font-display font-bold text-white leading-tight">
                {config.title} Kaart
              </h3>
              <p className="text-xs text-white/50 font-medium uppercase tracking-widest mt-0.5">
                Cozy Moments
              </p>
            </div>
          </div>
          <div
            className="px-4 py-1.5 rounded-full text-base font-bold text-white"
            style={{ background: 'rgba(255,255,255,0.18)' }}
          >
            {count}/10
          </div>
        </div>

        {/* Stamps grid — grows to fill space */}
        <div className="flex-1 flex items-center py-4">
          <div className="grid grid-cols-5 gap-3 w-full">
            {Array.from({ length: 10 }).map((_, i) => {
              const isFilled = i < count;
              const isFree = i === 9;

              return (
                <motion.div
                  key={i}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={stampVariants}
                  className="aspect-square rounded-full flex items-center justify-center"
                  style={{
                    background: isFilled ? config.stampActiveBg : 'rgba(255,255,255,0.12)',
                    border: isFilled ? '2.5px solid rgba(255,255,255,0.4)' : '2px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {isFilled ? (
                    <motion.div custom={i} initial="hidden" animate="visible" variants={checkVariants}>
                      <Check className="w-5 h-5 text-white" strokeWidth={3} />
                    </motion.div>
                  ) : isFree ? (
                    <span className="font-display font-bold text-[10px] text-white/60 leading-none">
                      Gratis
                    </span>
                  ) : (
                    <Icon className="w-4 h-4 text-white/20" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Motivation text */}
        <motion.p
          key={`${type}-${count}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-base text-white/65 font-serif text-center italic leading-tight"
        >
          {getMotivationText(count, type)}
        </motion.p>
      </div>
    </div>
  );
};
