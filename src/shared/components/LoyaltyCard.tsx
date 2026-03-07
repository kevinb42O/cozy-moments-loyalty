import React from 'react';
import { Coffee, Wine, Beer, GlassWater, Check } from 'lucide-react';
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
    title: 'Koffie Kaart',
    icon: Coffee,
    cardGradient: 'linear-gradient(150deg, #fffefb 0%, #f7f0e6 100%)',
    accent: '#5c4033',
    accentLight: '#e8dcc8',
    emptyBorder: 'rgba(92,64,51,0.22)',
    emptyBg: 'rgba(92,64,51,0.05)',
    shadowColor: 'rgba(92,64,51,0.18)',
    rewardRule: 'Gratis warme drank (max €3,50). Premium drank? Volle kaart = €3,50 korting!',
  },
  wine: {
    title: 'Wijn Kaart',
    icon: Wine,
    cardGradient: 'linear-gradient(150deg, #fffefe 0%, #faf1f2 100%)',
    accent: '#722f37',
    accentLight: '#f0d8dc',
    emptyBorder: 'rgba(114,47,55,0.20)',
    emptyBg: 'rgba(114,47,55,0.04)',
    shadowColor: 'rgba(114,47,55,0.16)',
    rewardRule: 'Gratis glas wijn (max €5,00). Duurdere wijn? Volle kaart = €5,00 korting!',
  },
  beer: {
    title: 'Bier Kaart',
    icon: Beer,
    cardGradient: 'linear-gradient(150deg, #fffffe 0%, #fdf8e8 100%)',
    accent: '#a07c10',
    accentLight: '#f5e9b0',
    emptyBorder: 'rgba(160,124,16,0.22)',
    emptyBg: 'rgba(160,124,16,0.04)',
    shadowColor: 'rgba(160,124,16,0.18)',
    rewardRule: 'Gratis vat-/flesbier (max €3,50). Speciaalbier? Volle kaart = €3,50 korting!',
  },
  soda: {
    title: 'Frisdrank Kaart',
    icon: GlassWater,
    cardGradient: 'linear-gradient(150deg, #fffeff 0%, #fce4f0 100%)',
    accent: '#c0407a',
    accentLight: '#f8d0e4',
    emptyBorder: 'rgba(192,64,122,0.22)',
    emptyBg: 'rgba(192,64,122,0.05)',
    shadowColor: 'rgba(192,64,122,0.18)',
    rewardRule: 'Gratis frisdrank (max €3,50). Duurdere drank? Volle kaart = €3,50 korting!',
  },
};

function getMotivationText(count: number, type: string): string {
  const drinkMap: Record<string, string> = { coffee: 'koffietje', wine: 'wijntje', beer: 'biertje', soda: 'frisje' };
  const emojiMap: Record<string, string> = { coffee: '☕', wine: '🍷', beer: '🍻', soda: '🧃' };
  const drink = drinkMap[type] || 'consumptie';
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



export const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ type, count }) => {
  const config = cardConfig[type];
  const Icon = config.icon;

  return (
    <div
      className="relative w-full rounded-[28px] overflow-hidden select-none"
      style={{
        background: config.cardGradient,
        aspectRatio: '1.58 / 1',
        boxShadow: `0 16px 48px -10px ${config.shadowColor}, 0 6px 16px -4px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)`,
        border: '1px solid rgba(255,255,255,0.9)',
      }}
    >

      {/* Top-right light sheen */}
      <div
        className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-50 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.85) 0%, transparent 70%)' }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-5">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0"
              style={{ background: config.accent }}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-[17px] font-display font-bold leading-tight" style={{ color: config.accent }}>
                {config.title}
              </h3>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-[0.15em] mt-0.5">
                Cozy Moments
              </p>
            </div>
          </div>
          <div
            className="px-3 py-1 rounded-full text-[13px] font-bold"
            style={{ background: config.accentLight, color: config.accent }}
          >
            {count}/10
          </div>
        </div>

        {/* Stamps */}
        <div className="grid grid-cols-5 gap-2 my-1">
          {Array.from({ length: 10 }).map((_, i) => {
            const isFilled = i < count;
            const isFree = i === 9;
            return (
              <div
                key={i}
                className="aspect-square rounded-full flex items-center justify-center"
                style={isFilled ? {
                  background: config.accent,
                  boxShadow: `0 2px 8px ${config.shadowColor}`,
                  border: `1.5px solid ${config.accent}`,
                } : {
                  background: config.emptyBg,
                  border: `1.5px solid ${config.emptyBorder}`,
                }}
              >
                {isFilled ? (
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                ) : isFree ? (
                  <span style={{ color: config.emptyBorder }} className="font-display font-bold text-[8px] leading-none text-center px-0.5">
                    Gratis
                  </span>
                ) : (
                  <Icon className="w-3 h-3" style={{ color: config.emptyBorder }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Motivation */}
        <motion.p
          key={`${type}-${count}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="text-[11.5px] text-gray-400 font-serif text-center italic leading-tight"
        >
          {getMotivationText(count, type)}
        </motion.p>

        {/* €5 Regel */}
        <p
          className="text-[10px] text-black/80 text-center leading-tight mt-1 px-2"
          style={{ letterSpacing: '0.02em' }}
        >
          {config.rewardRule}
        </p>

      </div>
    </div>
  );
};
