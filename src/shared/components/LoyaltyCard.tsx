import React from 'react';
import { Coffee, Wine, Beer, Check } from 'lucide-react';
import { CardType } from '../store/LoyaltyContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface LoyaltyCardProps {
  type: CardType;
  count: number;
}

const cardConfig = {
  coffee: {
    title: 'Koffie',
    icon: Coffee,
    color: 'text-[var(--color-cozy-coffee)]',
    bg: 'bg-[#e8dcc8]',
    activeBg: 'bg-[var(--color-cozy-coffee)]',
    activeText: 'text-[#e8dcc8]',
  },
  wine: {
    title: 'Wijn',
    icon: Wine,
    color: 'text-[var(--color-cozy-wine)]',
    bg: 'bg-[#f0d8dc]',
    activeBg: 'bg-[var(--color-cozy-wine)]',
    activeText: 'text-[#f0d8dc]',
  },
  beer: {
    title: 'Bier',
    icon: Beer,
    color: 'text-[var(--color-cozy-beer)]',
    bg: 'bg-[#fcf4d9]',
    activeBg: 'bg-[var(--color-cozy-beer)]',
    activeText: 'text-[#fcf4d9]',
  },
};

export const LoyaltyCard: React.FC<LoyaltyCardProps> = ({ type, count }) => {
  const config = cardConfig[type];
  const Icon = config.icon;

  return (
    <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-serif font-semibold flex items-center gap-2">
          <Icon className={cn("w-6 h-6", config.color)} />
          {config.title} Kaart
        </h3>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {count} / 10
        </span>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => {
          const isFilled = i < count;
          const isFree = i === 9;
          
          return (
            <div
              key={i}
              className={cn(
                "aspect-square rounded-full flex items-center justify-center transition-all duration-300",
                isFilled ? config.activeBg : config.bg,
                isFilled ? "shadow-inner" : ""
              )}
            >
              {isFilled ? (
                <Check className={cn("w-5 h-5", config.activeText)} strokeWidth={3} />
              ) : isFree ? (
                <span className={cn("font-serif font-bold text-lg", config.color)}>
                  Gratis
                </span>
              ) : (
                <Icon className={cn("w-5 h-5 opacity-30", config.color)} />
              )}
            </div>
          );
        })}
      </div>
      
      {count === 10 && (
        <div className="mt-4 text-center text-sm font-medium text-[var(--color-cozy-olive)] bg-[#f5f5f0] py-2 rounded-xl">
          Gefeliciteerd! Je volgende {config.title.toLowerCase()} is gratis!
        </div>
      )}
    </div>
  );
};
