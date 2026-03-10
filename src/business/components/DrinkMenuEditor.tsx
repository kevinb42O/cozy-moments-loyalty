import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DrinkMenuItem, DrinkMenuSection } from '../../shared/lib/drink-menu';

function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

interface DrinkMenuEditorProps {
  isDarkMode: boolean;
  sections: DrinkMenuSection[];
  dirty: boolean;
  saving: boolean;
  error: string | null;
  success: string | null;
  onAddSection: () => void;
  onMoveSection: (sectionId: string, direction: -1 | 1) => void;
  onRemoveSection: (sectionId: string) => void;
  onReset: () => void;
  onSave: () => void;
  onUpdateSection: (sectionId: string, patch: Partial<Pick<DrinkMenuSection, 'sectionCode' | 'title' | 'isVisible'>>) => void;
  onAddItem: (sectionId: string) => void;
  onMoveItem: (sectionId: string, itemId: string, direction: -1 | 1) => void;
  onRemoveItem: (sectionId: string, itemId: string) => void;
  onUpdateItem: (sectionId: string, itemId: string, patch: Partial<Pick<DrinkMenuItem, 'name' | 'price' | 'details' | 'isVisible'>>) => void;
}

export function DrinkMenuEditor({
  isDarkMode,
  sections,
  dirty,
  saving,
  error,
  success,
  onAddSection,
  onMoveSection,
  onRemoveSection,
  onReset,
  onSave,
  onUpdateSection,
  onAddItem,
  onMoveItem,
  onRemoveItem,
  onUpdateItem,
}: DrinkMenuEditorProps) {
  return (
    <div className="space-y-6 pb-10">
      <div className={cn(
        'rounded-[30px] border px-6 py-6 shadow-[0_20px_50px_rgba(61,48,30,0.08)]',
        isDarkMode ? 'border-white/10 bg-[#1a2230] text-[#f4f2ea]' : 'border-white/70 bg-white/80 text-[var(--color-cozy-text)]'
      )}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className={cn('text-xs font-semibold uppercase tracking-[0.24em]', isDarkMode ? 'text-[#b8c2d4]' : 'text-[var(--color-cozy-olive)]/70')}>
              Drankkaart
            </p>
            <h2 className="font-display text-3xl font-bold">Beheer de menukaart voor de website</h2>
            <p className={cn('text-sm leading-6', isDarkMode ? 'text-[#c3ccdb]' : 'text-gray-500')}>
              Pas secties, producten, prijzen en zichtbaarheid aan. Alles blijft lokaal in draft tot je op Opslaan klikt.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onReset}
              disabled={!dirty || saving}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                isDarkMode ? 'border border-white/10 bg-white/5 text-[#e6ecf5] hover:bg-white/10' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              <RotateCcw size={15} />
              Herladen
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                isDarkMode ? 'bg-[#d8c9a8] text-[#4d3a1b] hover:bg-[#e4d9bf]' : 'bg-[var(--color-cozy-olive)] text-white hover:bg-[var(--color-cozy-text)]'
              )}
            >
              <Save size={15} />
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <span className={cn('inline-flex rounded-full px-3 py-1 font-semibold', dirty ? (isDarkMode ? 'bg-[#273247] text-[#f7edd8]' : 'bg-[#f0e7d8] text-[var(--color-cozy-text)]') : (isDarkMode ? 'bg-white/5 text-[#9fb0ca]' : 'bg-gray-100 text-gray-500'))}>
            {dirty ? 'Niet-opgeslagen wijzigingen' : 'Alles opgeslagen'}
          </span>
          <span className={cn('inline-flex rounded-full px-3 py-1 font-semibold', isDarkMode ? 'bg-white/5 text-[#c3ccdb]' : 'bg-gray-100 text-gray-500')}>
            {sections.length} secties
          </span>
        </div>

        {error && (
          <div className={cn('mt-4 rounded-2xl border px-4 py-3 text-sm', isDarkMode ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-600')}>
            {error}
          </div>
        )}

        {success && (
          <div className={cn('mt-4 rounded-2xl border px-4 py-3 text-sm', isDarkMode ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
            {success}
          </div>
        )}
      </div>

      <div className="space-y-5">
        {sections.map((section, sectionIndex) => (
          <motion.div
            key={section.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-[28px] border p-5 shadow-[0_16px_40px_rgba(51,38,20,0.08)] transition-opacity',
              section.isVisible ? 'opacity-100' : 'opacity-75',
              isDarkMode ? 'border-white/10 bg-[#1a2230]' : 'border-white/70 bg-white/85'
            )}
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="grid flex-1 gap-3 md:grid-cols-[100px_minmax(0,1fr)]">
                <label className="space-y-1.5">
                  <span className={cn('text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-400')}>
                    Nummer
                  </span>
                  <input
                    value={section.sectionCode}
                    onChange={(event) => onUpdateSection(section.id, { sectionCode: event.target.value })}
                    placeholder="01"
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors',
                      isDarkMode ? 'border-white/10 bg-[#111826] text-[#f4f2ea] placeholder:text-[#64748b] focus:border-[#d8c9a8]' : 'border-gray-200 bg-[#fcfaf7] text-[var(--color-cozy-text)] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]'
                    )}
                  />
                </label>

                <label className="space-y-1.5">
                  <span className={cn('text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-400')}>
                    Sectietitel
                  </span>
                  <input
                    value={section.title}
                    onChange={(event) => onUpdateSection(section.id, { title: event.target.value })}
                    placeholder="Bijv. Cocktails"
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors',
                      isDarkMode ? 'border-white/10 bg-[#111826] text-[#f4f2ea] placeholder:text-[#64748b] focus:border-[#d8c9a8]' : 'border-gray-200 bg-[#fcfaf7] text-[var(--color-cozy-text)] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]'
                    )}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateSection(section.id, { isVisible: !section.isVisible })}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                    isDarkMode ? 'border border-white/10 bg-white/5 text-[#d9e2f1] hover:bg-white/10' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {section.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
                  {section.isVisible ? 'Zichtbaar' : 'Verborgen'}
                </button>
                <button type="button" onClick={() => onMoveSection(section.id, -1)} disabled={sectionIndex === 0} className={cn('rounded-full p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40', isDarkMode ? 'bg-white/5 text-[#d9e2f1] hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  <ArrowUp size={15} />
                </button>
                <button type="button" onClick={() => onMoveSection(section.id, 1)} disabled={sectionIndex === sections.length - 1} className={cn('rounded-full p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40', isDarkMode ? 'bg-white/5 text-[#d9e2f1] hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  <ArrowDown size={15} />
                </button>
                <button type="button" onClick={() => onRemoveSection(section.id)} className={cn('rounded-full p-2 transition-colors', isDarkMode ? 'bg-red-500/10 text-red-200 hover:bg-red-500/20' : 'bg-red-50 text-red-500 hover:bg-red-100')}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {section.items.map((item, itemIndex) => (
                <motion.div
                  key={item.id}
                  layout
                  className={cn(
                    'rounded-[24px] border p-4 transition-opacity',
                    item.isVisible ? 'opacity-100' : 'opacity-70',
                    isDarkMode ? 'border-white/10 bg-[#111826]' : 'border-[#efe6d8] bg-[#fffdf9]'
                  )}
                >
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_160px_auto]">
                    <label className="space-y-1.5">
                      <span className={cn('text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-400')}>
                        Product
                      </span>
                      <input
                        value={item.name}
                        onChange={(event) => onUpdateItem(section.id, item.id, { name: event.target.value })}
                        placeholder="Bijv. Espresso Martini"
                        className={cn(
                          'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors',
                          isDarkMode ? 'border-white/10 bg-[#0d1420] text-[#f4f2ea] placeholder:text-[#64748b] focus:border-[#d8c9a8]' : 'border-gray-200 bg-white text-[var(--color-cozy-text)] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]'
                        )}
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className={cn('text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-400')}>
                        Prijs
                      </span>
                      <input
                        value={item.price}
                        onChange={(event) => onUpdateItem(section.id, item.id, { price: event.target.value })}
                        placeholder="€ 0,00 of Op aanvraag"
                        className={cn(
                          'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors',
                          isDarkMode ? 'border-white/10 bg-[#0d1420] text-[#f4f2ea] placeholder:text-[#64748b] focus:border-[#d8c9a8]' : 'border-gray-200 bg-white text-[var(--color-cozy-text)] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]'
                        )}
                      />
                    </label>

                    <div className="flex flex-wrap items-end gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => onUpdateItem(section.id, item.id, { isVisible: !item.isVisible })}
                        className={cn(
                          'rounded-full p-2 transition-colors',
                          isDarkMode ? 'bg-white/5 text-[#d9e2f1] hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {item.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                      <button type="button" onClick={() => onMoveItem(section.id, item.id, -1)} disabled={itemIndex === 0} className={cn('rounded-full p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40', isDarkMode ? 'bg-white/5 text-[#d9e2f1] hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                        <ArrowUp size={15} />
                      </button>
                      <button type="button" onClick={() => onMoveItem(section.id, item.id, 1)} disabled={itemIndex === section.items.length - 1} className={cn('rounded-full p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40', isDarkMode ? 'bg-white/5 text-[#d9e2f1] hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                        <ArrowDown size={15} />
                      </button>
                      <button type="button" onClick={() => onRemoveItem(section.id, item.id)} className={cn('rounded-full p-2 transition-colors', isDarkMode ? 'bg-red-500/10 text-red-200 hover:bg-red-500/20' : 'bg-red-50 text-red-500 hover:bg-red-100')}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <label className="mt-3 block space-y-1.5">
                    <span className={cn('text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-400')}>
                      Extra info (optioneel)
                    </span>
                    <input
                      value={item.details}
                      onChange={(event) => onUpdateItem(section.id, item.id, { details: event.target.value })}
                      placeholder="Bijv. aardbei, banaan of 25 cl | 5,2%"
                      className={cn(
                        'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors',
                        isDarkMode ? 'border-white/10 bg-[#0d1420] text-[#f4f2ea] placeholder:text-[#64748b] focus:border-[#d8c9a8]' : 'border-gray-200 bg-white text-[var(--color-cozy-text)] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]'
                      )}
                    />
                  </label>
                </motion.div>
              ))}

              <button
                type="button"
                onClick={() => onAddItem(section.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  isDarkMode ? 'border border-dashed border-white/15 bg-white/5 text-[#f4f2ea] hover:bg-white/10' : 'border border-dashed border-[#d8c9a8] bg-[#fcf8f2] text-[var(--color-cozy-text)] hover:bg-[#f5ecdf]'
                )}
              >
                <Plus size={15} />
                Product toevoegen
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddSection}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors',
          isDarkMode ? 'border border-dashed border-white/15 bg-white/5 text-[#f4f2ea] hover:bg-white/10' : 'border border-dashed border-[#d8c9a8] bg-[#fcf8f2] text-[var(--color-cozy-text)] hover:bg-[#f5ecdf]'
        )}
      >
        <Plus size={16} />
        Nieuwe sectie toevoegen
      </button>
    </div>
  );
}