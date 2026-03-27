import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DrinkMenuGroup, DrinkMenuItem, DrinkMenuSection } from '../../shared/lib/drink-menu';

function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

interface DragItemPayload {
  sectionId: string;
  itemId: string;
  fromGroupId: string | null;
}

interface DrinkMenuEditorProps {
  isDarkMode: boolean;
  sections: DrinkMenuSection[];
  activePromoItemIds: string[];
  activePromoProductName: string | null;
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
  onAddGroup: (sectionId: string) => void;
  onMoveGroup: (sectionId: string, groupId: string, direction: -1 | 1) => void;
  onRemoveGroup: (sectionId: string, groupId: string) => void;
  onUpdateGroup: (sectionId: string, groupId: string, title: string) => void;
  onAssignItemToGroup: (sectionId: string, itemId: string, groupId: string | null, targetIndex?: number) => void;
  onMoveGroupedItem: (sectionId: string, groupId: string, itemId: string, direction: -1 | 1) => void;
  onAssignUngroupedToDefaultGroup: (sectionId: string) => void;
  onAutofillLegacyGroups: () => void;
  onAddItem: (sectionId: string) => void;
  onMoveItem: (sectionId: string, itemId: string, direction: -1 | 1) => void;
  onRemoveItem: (sectionId: string, itemId: string) => void;
  onUpdateItem: (sectionId: string, itemId: string, patch: Partial<Pick<DrinkMenuItem, 'name' | 'price' | 'details' | 'isVisible'>>) => void;
}

function parseDragPayload(event: React.DragEvent): DragItemPayload | null {
  const raw = event.dataTransfer.getData('application/json');
  if (!raw) {
    return null;
  }

  try {
    const payload = JSON.parse(raw) as Partial<DragItemPayload>;
    if (
      typeof payload.sectionId !== 'string' ||
      typeof payload.itemId !== 'string' ||
      (typeof payload.fromGroupId !== 'string' && payload.fromGroupId !== null)
    ) {
      return null;
    }

    return {
      sectionId: payload.sectionId,
      itemId: payload.itemId,
      fromGroupId: payload.fromGroupId,
    };
  } catch {
    return null;
  }
}

function renderPreviewGroup(
  group: DrinkMenuGroup,
  items: DrinkMenuItem[],
  itemById: Map<string, DrinkMenuItem>,
  isDarkMode: boolean,
  sectionId: string,
  onAssignItemToGroup: (sectionId: string, itemId: string, groupId: string | null, targetIndex?: number) => void,
) {
  const groupItems = group.itemIds
    .map((itemId) => itemById.get(itemId))
    .filter((item): item is DrinkMenuItem => Boolean(item));

  if (groupItems.length === 0) {
    return null;
  }

  return (
    <div key={group.id}>
      <h4 className={cn('mb-4 text-xs font-semibold uppercase tracking-[0.24em]', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-500')}>
        {group.title || 'Subtitel'}
      </h4>
      <div className="grid grid-cols-1 gap-x-10 gap-y-2 md:grid-cols-2">
        {groupItems.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm',
              isDarkMode ? 'border-white/10 bg-[#111826] text-[#f4f2ea]' : 'border-[#efe6d8] bg-[#fffdf9] text-[var(--color-cozy-text)]'
            )}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData(
                'application/json',
                JSON.stringify({ sectionId, itemId: item.id, fromGroupId: group.id } satisfies DragItemPayload),
              );
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const payload = parseDragPayload(event);
              if (!payload || payload.sectionId !== sectionId || payload.itemId === item.id) {
                return;
              }

              const targetIndex = group.itemIds.findIndex((id) => id === item.id);
              if (targetIndex < 0) {
                return;
              }

              onAssignItemToGroup(sectionId, payload.itemId, group.id, targetIndex);
            }}
          >
            <span className="truncate pr-4">{item.name || 'Naamloos product'}</span>
            <span className={cn('shrink-0 text-xs font-semibold', isDarkMode ? 'text-[#d8c9a8]' : 'text-[var(--color-cozy-olive)]')}>
              {item.price || 'Prijs leeg'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DrinkMenuEditor({
  isDarkMode,
  sections,
  activePromoItemIds,
  activePromoProductName,
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
  onAddGroup,
  onMoveGroup,
  onRemoveGroup,
  onUpdateGroup,
  onAssignItemToGroup,
  onMoveGroupedItem,
  onAssignUngroupedToDefaultGroup,
  onAutofillLegacyGroups,
  onAddItem,
  onMoveItem,
  onRemoveItem,
  onUpdateItem,
}: DrinkMenuEditorProps) {
  const [openSectionId, setOpenSectionId] = React.useState<string | null>(null);
  const activePromoItemIdSet = React.useMemo(() => new Set(activePromoItemIds), [activePromoItemIds]);

  React.useEffect(() => {
    if (!openSectionId) return;
    if (sections.some((section) => section.id === openSectionId)) return;
    setOpenSectionId(null);
  }, [openSectionId, sections]);

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
              Beheer secties, subtitels en producten. Je ziet meteen een live preview zoals op de website.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onAutofillLegacyGroups}
              disabled={saving || sections.length === 0}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                isDarkMode ? 'border border-white/10 bg-white/5 text-[#e6ecf5] hover:bg-white/10' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              <Plus size={15} />
              Importeer bestaande subtitels
            </button>
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
          {activePromoItemIds.length > 0 && (
            <span className={cn('inline-flex rounded-full px-3 py-1 font-semibold', isDarkMode ? 'bg-amber-500/15 text-amber-200' : 'bg-amber-50 text-amber-700')}>
              Amber = actief in open fles promo{activePromoProductName ? `: ${activePromoProductName}` : ''}
            </span>
          )}
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
        {sections.map((section, sectionIndex) => {
          const groups = section.groups ?? [];
          const itemById = new Map(section.items.map((item) => [item.id, item]));
          const itemGroupLookup = new Map<string, string>();

          groups.forEach((group) => {
            group.itemIds.forEach((itemId) => {
              if (itemById.has(itemId)) {
                itemGroupLookup.set(itemId, group.id);
              }
            });
          });

          const ungroupedItems = section.items.filter((item) => !itemGroupLookup.has(item.id));
          const activePromoCount = section.items.filter((item) => activePromoItemIdSet.has(item.id)).length;

          return (
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
              <button
                type="button"
                onClick={() => setOpenSectionId((current) => current === section.id ? null : section.id)}
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <div className="min-w-0">
                  <p className={cn('truncate font-display text-xl font-bold', isDarkMode ? 'text-[#f4f2ea]' : 'text-[var(--color-cozy-text)]')}>
                    {section.title || 'Nieuwe sectie'}
                  </p>
                  <p className={cn('mt-1 text-xs font-medium', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-500')}>
                    {section.items.length} producten • {groups.length} subtitels
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {activePromoCount > 0 && (
                    <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', isDarkMode ? 'bg-amber-500/15 text-amber-200' : 'bg-amber-50 text-amber-700')}>
                      {activePromoCount} in promo
                    </span>
                  )}
                  <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', section.isVisible ? (isDarkMode ? 'bg-emerald-500/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700') : (isDarkMode ? 'bg-white/5 text-[#9fb0ca]' : 'bg-gray-100 text-gray-500'))}>
                    {section.isVisible ? 'Zichtbaar' : 'Verborgen'}
                  </span>
                  <motion.span animate={{ rotate: openSectionId === section.id ? 180 : 0 }} transition={{ duration: 0.18 }} className={cn('rounded-full p-2', isDarkMode ? 'bg-white/5 text-[#d9e2f1]' : 'bg-gray-100 text-gray-600')}>
                    <ChevronDown size={16} />
                  </motion.span>
                </div>
              </button>

              {openSectionId === section.id && (
                <div className="mt-5 space-y-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex-1">
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

                  <div className={cn('rounded-3xl border px-4 py-4', isDarkMode ? 'border-white/10 bg-[#111826]' : 'border-[#efe6d8] bg-[#fffdf9]')}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className={cn('text-sm font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-500')}>
                        Subtitels per categorie
                      </h3>
                      <button
                        type="button"
                        onClick={() => onAddGroup(section.id)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors',
                          isDarkMode ? 'border border-dashed border-white/20 bg-white/5 text-[#f4f2ea] hover:bg-white/10' : 'border border-dashed border-[#d8c9a8] bg-[#fcf8f2] text-[var(--color-cozy-text)] hover:bg-[#f5ecdf]'
                        )}
                      >
                        <Plus size={14} />
                        Subtitel toevoegen
                      </button>
                    </div>

                    {groups.length === 0 && (
                      <p className={cn('rounded-2xl border border-dashed px-3 py-3 text-sm', isDarkMode ? 'border-white/15 text-[#9fb0ca]' : 'border-[#e8ddcb] text-gray-500')}>
                        Nog geen subtitels. Klik bovenaan op "Importeer bestaande subtitels" of maak er zelf eentje aan.
                      </p>
                    )}

                    <div className="space-y-3">
                      {groups.map((group, groupIndex) => {
                        const groupItems = group.itemIds
                          .map((itemId) => itemById.get(itemId))
                          .filter((item): item is DrinkMenuItem => Boolean(item));

                        return (
                          <div key={group.id} className={cn('rounded-2xl border p-3', isDarkMode ? 'border-white/10 bg-white/5' : 'border-[#e9decd] bg-white')}>
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <input
                                value={group.title}
                                onChange={(event) => onUpdateGroup(section.id, group.id, event.target.value)}
                                placeholder="Subtitel"
                                className={cn(
                                  'min-w-[200px] flex-1 rounded-xl border px-3 py-2 text-sm outline-none',
                                  isDarkMode ? 'border-white/10 bg-[#0d1420] text-[#f4f2ea] placeholder:text-[#64748b] focus:border-[#d8c9a8]' : 'border-gray-200 bg-white text-[var(--color-cozy-text)] placeholder:text-gray-400 focus:border-[var(--color-cozy-olive)]'
                                )}
                              />
                              <button type="button" onClick={() => onMoveGroup(section.id, group.id, -1)} disabled={groupIndex === 0} className={cn('rounded-full p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40', isDarkMode ? 'bg-white/5 text-[#d9e2f1] hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                <ArrowUp size={14} />
                              </button>
                              <button type="button" onClick={() => onMoveGroup(section.id, group.id, 1)} disabled={groupIndex === groups.length - 1} className={cn('rounded-full p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40', isDarkMode ? 'bg-white/5 text-[#d9e2f1] hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                <ArrowDown size={14} />
                              </button>
                              <button type="button" onClick={() => onRemoveGroup(section.id, group.id)} className={cn('rounded-full p-2 transition-colors', isDarkMode ? 'bg-red-500/10 text-red-200 hover:bg-red-500/20' : 'bg-red-50 text-red-500 hover:bg-red-100')}>
                                <Trash2 size={14} />
                              </button>
                            </div>

                            <div
                              className={cn('rounded-xl border border-dashed p-3', isDarkMode ? 'border-white/20 bg-[#0d1420]' : 'border-[#e8ddcb] bg-[#fcfaf6]')}
                              onDragOver={(event) => {
                                event.preventDefault();
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                const payload = parseDragPayload(event);
                                if (!payload || payload.sectionId !== section.id) {
                                  return;
                                }

                                onAssignItemToGroup(section.id, payload.itemId, group.id);
                              }}
                            >
                              {groupItems.length === 0 ? (
                                <p className={cn('text-xs', isDarkMode ? 'text-[#9fb0ca]' : 'text-gray-500')}>
                                  Sleep producten hierheen of kies de subtitel in de productkaart.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {groupItems.map((item, itemIndex) => (
                                    <div
                                      key={item.id}
                                      className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm', isDarkMode ? 'border-white/10 bg-[#111826] text-[#f4f2ea]' : 'border-[#ece2d3] bg-white text-[var(--color-cozy-text)]')}
                                      draggable
                                      onDragStart={(event) => {
                                        event.dataTransfer.effectAllowed = 'move';
                                        event.dataTransfer.setData('application/json', JSON.stringify({ sectionId: section.id, itemId: item.id, fromGroupId: group.id } satisfies DragItemPayload));
                                      }}
                                      onDragOver={(event) => {
                                        event.preventDefault();
                                      }}
                                      onDrop={(event) => {
                                        event.preventDefault();
                                        const payload = parseDragPayload(event);
                                        if (!payload || payload.sectionId !== section.id) {
                                          return;
                                        }
                                        onAssignItemToGroup(section.id, payload.itemId, group.id, itemIndex);
                                      }}
                                    >
                                      <span className="min-w-0 flex-1 truncate">{item.name || 'Naamloos product'}</span>
                                      <span className={cn('text-xs font-semibold', isDarkMode ? 'text-[#d8c9a8]' : 'text-[var(--color-cozy-olive)]')}>
                                        {item.price || 'Prijs leeg'}
                                      </span>
                                      <button type="button" onClick={() => onMoveGroupedItem(section.id, group.id, item.id, -1)} disabled={itemIndex === 0} className={cn('rounded-full p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40', isDarkMode ? 'bg-white/5 text-[#d9e2f1] hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                        <ArrowUp size={12} />
                                      </button>
                                      <button type="button" onClick={() => onMoveGroupedItem(section.id, group.id, item.id, 1)} disabled={itemIndex === groupItems.length - 1} className={cn('rounded-full p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40', isDarkMode ? 'bg-white/5 text-[#d9e2f1] hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                        <ArrowDown size={12} />
                                      </button>
                                      <button type="button" onClick={() => onAssignItemToGroup(section.id, item.id, null)} className={cn('rounded-full p-1.5 transition-colors', isDarkMode ? 'bg-white/5 text-[#d9e2f1] hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                                        <EyeOff size={12} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div
                      className={cn('mt-3 rounded-2xl border border-dashed px-3 py-3', isDarkMode ? 'border-white/15 bg-[#0d1420]' : 'border-[#e8ddcb] bg-[#fcfaf6]')}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const payload = parseDragPayload(event);
                        if (!payload || payload.sectionId !== section.id) {
                          return;
                        }
                        onAssignItemToGroup(section.id, payload.itemId, null);
                      }}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-500')}>
                          Nog te plaatsen
                        </p>
                        {ungroupedItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onAssignUngroupedToDefaultGroup(section.id)}
                            className={cn(
                              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                              isDarkMode ? 'border border-white/10 bg-white/5 text-[#e6ecf5] hover:bg-white/10' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            Zet alles in Overige
                          </button>
                        )}
                      </div>
                      {ungroupedItems.length === 0 ? (
                        <p className={cn('text-xs', isDarkMode ? 'text-[#9fb0ca]' : 'text-gray-500')}>
                          Top, alle producten zitten in een subtitel.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {ungroupedItems.map((item) => (
                            <span
                              key={item.id}
                              className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium', isDarkMode ? 'bg-white/10 text-[#e6ecf5]' : 'bg-white text-gray-700 border border-gray-200')}
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData('application/json', JSON.stringify({ sectionId: section.id, itemId: item.id, fromGroupId: null } satisfies DragItemPayload));
                              }}
                            >
                              {item.name || 'Naamloos product'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={cn('rounded-3xl border px-4 py-4', isDarkMode ? 'border-white/10 bg-[#111826]' : 'border-[#efe6d8] bg-[#fffdf9]')}>
                    <h3 className={cn('mb-4 text-sm font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-500')}>
                      Live preview website-layout
                    </h3>

                    {section.items.length === 0 ? (
                      <p className={cn('text-sm', isDarkMode ? 'text-[#9fb0ca]' : 'text-gray-500')}>
                        Voeg eerst producten toe om een preview te zien.
                      </p>
                    ) : (
                      <div className="space-y-8">
                        {groups.map((group) => renderPreviewGroup(group, section.items, itemById, isDarkMode, section.id, onAssignItemToGroup))}
                        {ungroupedItems.length > 0 && (
                          <div>
                            <h4 className={cn('mb-4 text-xs font-semibold uppercase tracking-[0.24em]', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-500')}>
                              Overige
                            </h4>
                            <div className="grid grid-cols-1 gap-x-10 gap-y-2 md:grid-cols-2">
                              {ungroupedItems.map((item) => (
                                <div
                                  key={item.id}
                                  className={cn(
                                    'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm',
                                    isDarkMode ? 'border-white/10 bg-[#111826] text-[#f4f2ea]' : 'border-[#efe6d8] bg-[#fffdf9] text-[var(--color-cozy-text)]'
                                  )}
                                  draggable
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('application/json', JSON.stringify({ sectionId: section.id, itemId: item.id, fromGroupId: null } satisfies DragItemPayload));
                                  }}
                                >
                                  <span className="truncate pr-4">{item.name || 'Naamloos product'}</span>
                                  <span className={cn('shrink-0 text-xs font-semibold', isDarkMode ? 'text-[#d8c9a8]' : 'text-[var(--color-cozy-olive)]')}>
                                    {item.price || 'Prijs leeg'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {section.items.map((item, itemIndex) => {
                      const isPromoActive = activePromoItemIdSet.has(item.id);
                      const assignedGroupId = itemGroupLookup.get(item.id) ?? '';

                      return (
                        <motion.div
                          key={item.id}
                          layout
                          className={cn(
                            'rounded-[24px] border p-4 transition-opacity',
                            item.isVisible ? 'opacity-100' : 'opacity-70',
                            isPromoActive
                              ? (isDarkMode ? 'border-amber-300/35 bg-amber-500/10' : 'border-amber-200 bg-amber-50/80')
                              : (isDarkMode ? 'border-white/10 bg-[#111826]' : 'border-[#efe6d8] bg-[#fffdf9]')
                          )}
                        >
                          {isPromoActive && (
                            <div className={cn('mb-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold', isDarkMode ? 'bg-amber-500/15 text-amber-200' : 'bg-amber-100 text-amber-800')}>
                              Actief in open fles promo
                            </div>
                          )}

                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_150px_220px_auto]">
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

                            <label className="space-y-1.5">
                              <span className={cn('text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-[#97a8c4]' : 'text-gray-400')}>
                                Subtitel
                              </span>
                              <select
                                value={assignedGroupId}
                                onChange={(event) => {
                                  const groupId = event.target.value || null;
                                  onAssignItemToGroup(section.id, item.id, groupId);
                                }}
                                className={cn(
                                  'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-colors',
                                  isDarkMode ? 'border-white/10 bg-[#0d1420] text-[#f4f2ea] focus:border-[#d8c9a8]' : 'border-gray-200 bg-white text-[var(--color-cozy-text)] focus:border-[var(--color-cozy-olive)]'
                                )}
                              >
                                <option value="">Geen subtitel</option>
                                {groups.map((group) => (
                                  <option key={group.id} value={group.id}>
                                    {group.title || 'Subtitel'}
                                  </option>
                                ))}
                              </select>
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
                        </motion.div>
                      );
                    })}
                  </div>

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
              )}
            </motion.div>
          );
        })}
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
