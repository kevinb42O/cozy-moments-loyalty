import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface DeltaControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  accent: 'olive' | 'amber' | 'rose' | 'blue';
  baseValue?: number;
  minValue?: number;
  maxValue?: number;
  disabled?: boolean;
}

function cn(...inputs: Array<string | undefined | null | false>) {
  return twMerge(clsx(inputs));
}

const deltaAccentClass: Record<DeltaControlProps['accent'], string> = {
  olive: 'bg-[var(--color-cozy-olive)]/8 text-[var(--color-cozy-text)]',
  amber: 'bg-amber-50 text-amber-800',
  rose: 'bg-rose-50 text-rose-800',
  blue: 'bg-blue-50 text-blue-800',
};

const deltaAccentBorderClass: Record<DeltaControlProps['accent'], string> = {
  olive: 'border-[var(--color-cozy-olive)]/15',
  amber: 'border-amber-200/70',
  rose: 'border-rose-200/70',
  blue: 'border-blue-200/70',
};

export const DeltaControl: React.FC<DeltaControlProps> = ({
  label,
  value,
  onChange,
  accent,
  baseValue,
  minValue,
  maxValue,
  disabled = false,
}) => {
  const effectiveValue = baseValue !== undefined ? baseValue + value : value;
  const changeText = value === 0 ? 'Geen wijziging' : `Wijziging ${value > 0 ? `+${value}` : value}`;
  const helperText = baseValue !== undefined ? 'Min = terugdraaien, plus = toevoegen' : 'Negatief = terugdraaien, positief = toevoegen';
  const canDecrease = !disabled && (minValue === undefined || value > minValue);
  const canIncrease = !disabled && (maxValue === undefined || value < maxValue);

  const updateValue = (nextValue: number) => {
    const clampedValue = Math.max(minValue ?? Number.NEGATIVE_INFINITY, Math.min(maxValue ?? Number.POSITIVE_INFINITY, nextValue));
    onChange(clampedValue);
  };

  return (
    <div
      className={cn(
        'bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 flex items-center justify-between gap-3',
        disabled && 'opacity-60',
      )}
    >
      <div>
        <p className="text-sm font-medium text-[var(--color-cozy-text)]">{label}</p>
        <p className="text-[11px] text-gray-400">{helperText}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => updateValue(value - 1)}
          disabled={!canDecrease}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-transform disabled:opacity-40 disabled:hover:bg-white disabled:active:scale-100"
        >
          <Minus size={16} />
        </button>
        <div className="min-w-[110px] space-y-1 text-center">
          <span
            className={cn(
              'block rounded-full border bg-white px-3 py-1.5 font-mono text-sm font-bold text-[var(--color-cozy-text)]',
              deltaAccentBorderClass[accent],
            )}
          >
            {effectiveValue}
          </span>
          <span
            className={cn(
              'block rounded-full px-3 py-1 text-[11px] font-semibold',
              deltaAccentClass[accent],
              value === 0 && 'bg-gray-100 text-gray-500',
            )}
          >
            {changeText}
          </span>
        </div>
        <button
          type="button"
          onClick={() => updateValue(value + 1)}
          disabled={!canIncrease}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-100 active:scale-90 transition-transform disabled:opacity-40 disabled:hover:bg-white disabled:active:scale-100"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};
