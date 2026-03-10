import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown, ImagePlus, Minus, MonitorPlay, Play, Plus, RotateCcw, Save, Upload } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MAX_SLIDE_DURATION_MS,
  MAX_SCREENAVER_UPLOAD_FILE_SIZE_BYTES,
  MAX_SCREENSAVER_UPLOAD_LONG_SIDE_PX,
  MAX_SCREENSAVER_UPLOAD_TOTAL_PIXELS,
  MIN_SLIDE_DURATION_MS,
  MIN_SCREENSAVER_UPLOAD_SHORT_SIDE_PX,
  resolvePrimarySlideImage,
  resolveLeftSlideImage,
  resolveRightSlideImage,
  resolveSecondarySlideImage,
  type ScreensaverImageRole,
  type ScreensaverSlideConfig,
} from '../../shared/lib/screensaver-config';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type ScreensaverEditorProps = {
  isDarkMode: boolean;
  slides: ScreensaverSlideConfig[];
  dirty: boolean;
  saving: boolean;
  uploadingTarget: string | null;
  error: string | null;
  success: string | null;
  onMoveSlide: (slideId: string, direction: -1 | 1) => void;
  onSwapSlideSides: (slideId: string) => void;
  onDurationChange: (slideId: string, durationMs: number) => void;
  onUploadImage: (slideId: string, role: ScreensaverImageRole, file: File) => Promise<void>;
  onResetImage: (slideId: string, role: ScreensaverImageRole) => void;
  onResetAll: () => void;
  onPreview: () => void;
  onSave: () => Promise<void>;
};

function formatSeconds(durationMs: number) {
  return Math.round(durationMs / 1000);
}

function formatMegabytes(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(0);
}

const DEVICE_PREVIEW_ASPECT_CLASS = 'aspect-[4/3]';

export const ScreensaverEditor: React.FC<ScreensaverEditorProps> = ({
  isDarkMode,
  slides,
  dirty,
  saving,
  uploadingTarget,
  error,
  success,
  onMoveSlide,
  onSwapSlideSides,
  onDurationChange,
  onUploadImage,
  onResetImage,
  onResetAll,
  onPreview,
  onSave,
}) => {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [openSlideId, setOpenSlideId] = useState<string | null>(null);

  const setFileInputRef = (key: string, node: HTMLInputElement | null) => {
    fileInputRefs.current[key] = node;
  };

  const openFilePicker = (slideId: string, role: ScreensaverImageRole) => {
    fileInputRefs.current[`${slideId}:${role}`]?.click();
  };

  return (
    <div className="space-y-6">
      <div className={cn('rounded-[28px] shadow-sm border p-6 md:p-7', isDarkMode ? 'bg-[#171c24] border-white/10' : 'bg-white border-black/5')}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'bg-[#1f2734] border-white/15 text-[#d8dee8]' : 'bg-[#ebe4d7] border-transparent text-[var(--color-cozy-olive)]')}>
              <MonitorPlay size={14} />
              Screensaver
            </div>
            <h2 className={cn('mt-4 text-3xl font-display font-bold text-[var(--color-cozy-text)]', isDarkMode && 'text-[#f2f5fa]')}>
              Screensaver beheer
            </h2>
          </div>

          <div className="w-full md:w-[360px] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onPreview}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors',
                  isDarkMode
                    ? 'border-white/15 bg-[#1f2734] text-[#d8dee8] hover:bg-[#253042]'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                <Play size={16} />
                Preview nu
              </button>
              <button
                type="button"
                onClick={onResetAll}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors',
                  isDarkMode
                    ? 'border-white/15 bg-[#1f2734] text-[#d8dee8] hover:bg-[#253042]'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                <RotateCcw size={16} />
                Reset standaard
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onSave();
              }}
              disabled={!dirty || saving}
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-semibold transition-all',
                dirty && !saving
                  ? 'bg-[var(--color-cozy-olive)] text-white shadow-[0_10px_22px_rgba(70,62,48,0.24)] hover:opacity-90'
                  : 'cursor-not-allowed',
                !dirty && !saving && isDarkMode && 'bg-[#2c3340] text-[#7f8da2] border border-white/10',
                !dirty && !saving && !isDarkMode && 'bg-gray-200 text-gray-500',
                saving && isDarkMode && 'bg-[#2c3340] text-[#7f8da2] border border-white/10',
                saving && !isDarkMode && 'bg-gray-200 text-gray-500'
              )}
            >
              <Save size={18} />
              {saving ? 'Opslaan...' : 'Screensaver opslaan'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-gray-500 md:grid-cols-3">
          <div className={cn('rounded-2xl px-4 py-3 min-h-[84px] flex items-center justify-center text-center', isDarkMode ? 'bg-[#202733] text-[#cdd5df]' : 'bg-[#f7f3ed]')}>
            Exact 9 slides, afbeelding naar keuze
          </div>
          <div className={cn('rounded-2xl px-4 py-3 min-h-[84px] flex items-center justify-center text-center', isDarkMode ? 'bg-[#202733] text-[#cdd5df]' : 'bg-[#f7f3ed]')}>
            Per slide eigen duur tussen {formatSeconds(MIN_SLIDE_DURATION_MS)} en {formatSeconds(MAX_SLIDE_DURATION_MS)} seconden
          </div>
          <div className={cn('rounded-2xl px-4 py-3 min-h-[84px] flex items-center justify-center text-center', isDarkMode ? 'bg-[#202733] text-[#cdd5df]' : 'bg-[#f7f3ed]')}>
            Uploadlimiet: max {formatMegabytes(MAX_SCREENAVER_UPLOAD_FILE_SIZE_BYTES)} MB
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {slides.map((slide, index) => {
          const primaryKey = `${slide.id}:primary`;
          const secondaryKey = `${slide.id}:secondary`;
          const isDual = slide.mode === 'dual';
          const primaryImageUrl = resolvePrimarySlideImage(slide);
          const secondaryImageUrl = resolveSecondarySlideImage(slide);
          const leftImageUrl = resolveLeftSlideImage(slide);
          const rightImageUrl = resolveRightSlideImage(slide);
          const isOpen = openSlideId === slide.id;

          return (
            <div
              key={slide.id}
              className={cn('overflow-hidden rounded-[28px] border shadow-sm', isDarkMode ? 'bg-[#171c24] border-white/10' : 'bg-white border-black/5')}
            >
              <button
                type="button"
                onClick={() => setOpenSlideId((current) => current === slide.id ? null : slide.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-[#ebe4d7] px-3 text-sm font-bold text-[var(--color-cozy-olive)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xl font-display font-bold text-[var(--color-cozy-text)]">{slide.title}</h3>
                    <p className="text-sm text-gray-500">
                      {isDual ? 'Dubbele slide met 2 beelden' : 'Enkele slide met 1 beeld'} • {formatSeconds(slide.durationMs)} sec
                    </p>
                  </div>
                </div>

                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn('flex h-10 w-10 items-center justify-center rounded-full text-gray-500', isDarkMode ? 'bg-[#202733]' : 'bg-[#faf8f3]')}
                >
                  <ChevronDown size={18} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className={cn('px-5 pb-5 pt-5 md:px-6 md:pb-6', isDarkMode ? 'border-t border-white/10' : 'border-t border-black/5')}>
                      <div className={cn('flex flex-col gap-5', isDual ? 'xl:grid xl:grid-cols-[1fr_auto_1fr] xl:items-start' : 'xl:flex-row xl:items-start xl:justify-between')}>
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onMoveSlide(slide.id, -1)}
                              disabled={index === 0}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                                index === 0
                                  ? 'cursor-not-allowed border-gray-200 text-gray-300'
                                  : (isDarkMode ? 'border-white/15 text-[#d6deea] hover:bg-[#232d3d]' : 'border-gray-200 text-gray-600 hover:bg-gray-50')
                              )}
                            >
                              <ArrowUp size={15} />
                              Omhoog
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveSlide(slide.id, 1)}
                              disabled={index === slides.length - 1}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                                index === slides.length - 1
                                  ? 'cursor-not-allowed border-gray-200 text-gray-300'
                                  : (isDarkMode ? 'border-white/15 text-[#d6deea] hover:bg-[#232d3d]' : 'border-gray-200 text-gray-600 hover:bg-gray-50')
                              )}
                            >
                              <ArrowDown size={15} />
                              Omlaag
                            </button>
                          </div>
                        </div>

                        {isDual && (
                          <div className="xl:flex xl:justify-center">
                            <button
                              type="button"
                              onClick={() => onSwapSlideSides(slide.id)}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors',
                                isDarkMode
                                  ? 'border-white/15 bg-[#1f2734] text-[#d6deea] hover:bg-[#253042]'
                                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                              )}
                            >
                              <ArrowLeftRight size={15} />
                              Wissel links/rechts
                            </button>
                          </div>
                        )}

                        <label className="block min-w-[220px]">
                          <span className={cn('mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-cozy-text)]', isDarkMode && 'text-[#e4ebf5]')}>
                            Duur per slide
                          </span>
                          <div className={cn('flex items-center justify-between gap-3 rounded-2xl border px-3 py-3', isDarkMode ? 'border-white/15 bg-[#1a2230]' : 'border-gray-200 bg-[#faf8f3]')}>
                            <button
                              type="button"
                              onClick={() => onDurationChange(slide.id, slide.durationMs - 1000)}
                              className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition-colors', isDarkMode ? 'bg-[#343d4b] text-[#e5ebf5] hover:bg-[#404b5d]' : 'bg-white text-gray-600 hover:bg-gray-50')}
                            >
                              <Minus size={16} />
                            </button>
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                min={formatSeconds(MIN_SLIDE_DURATION_MS)}
                                max={formatSeconds(MAX_SLIDE_DURATION_MS)}
                                value={formatSeconds(slide.durationMs)}
                                onChange={(event) => onDurationChange(slide.id, Number(event.target.value) * 1000)}
                                className={cn('w-16 bg-transparent text-center text-lg font-semibold text-[var(--color-cozy-text)] outline-none', isDarkMode && 'text-[#f0f4fb]')}
                              />
                              <span className={cn('text-sm text-gray-500', isDarkMode && 'text-[#b7c1cf]')}>seconden</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onDurationChange(slide.id, slide.durationMs + 1000)}
                              className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition-colors', isDarkMode ? 'bg-[#343d4b] text-[#e5ebf5] hover:bg-[#404b5d]' : 'bg-white text-gray-600 hover:bg-gray-50')}
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </label>
                      </div>

                      <div className={cn('mt-5 grid gap-4', isDual ? 'lg:grid-cols-2' : 'lg:grid-cols-1')}>
                        {[
                          {
                            role: slide.swapSides ? 'secondary' as const : 'primary' as const,
                            label: isDual ? 'Linker afbeelding' : 'Afbeelding',
                            imageUrl: isDual ? leftImageUrl : primaryImageUrl,
                            customImageUrl: slide.swapSides ? slide.customSecondaryImageUrl : slide.customPrimaryImageUrl,
                            inputKey: primaryKey,
                          },
                          ...(isDual
                            ? [{
                              role: slide.swapSides ? 'primary' as const : 'secondary' as const,
                              label: 'Rechter afbeelding',
                              imageUrl: rightImageUrl,
                              customImageUrl: slide.swapSides ? slide.customPrimaryImageUrl : slide.customSecondaryImageUrl,
                              inputKey: secondaryKey,
                            }]
                            : []),
                        ].map((imageSlot) => (
                          <div key={imageSlot.inputKey} className={cn('rounded-[24px] border p-4', isDarkMode ? 'border-white/15 bg-[#1a2230]' : 'border-gray-200 bg-[#faf8f3]')}>
                            <div className="flex items-center justify-between gap-3">
                      <div>
                                <p className={cn('text-sm font-semibold text-[var(--color-cozy-text)]', isDarkMode && 'text-[#e7edf7]')}>{imageSlot.label}</p>
                                <p className={cn('text-xs text-gray-500', isDarkMode && 'text-[#b7c1cf]')}>
                                  {imageSlot.customImageUrl ? 'Eigen afbeelding actief' : 'Standaard afbeelding actief'}
                                </p>
                              </div>
                              <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm', isDarkMode ? 'bg-[#343d4b] text-[#e3e9f3]' : 'bg-white text-gray-500')}>
                                {imageSlot.customImageUrl ? 'Eigen' : 'Standaard'}
                              </span>
                            </div>

                            <div className={cn('mt-4 overflow-hidden rounded-[24px] border', DEVICE_PREVIEW_ASPECT_CLASS, isDarkMode ? 'border-white/10 bg-[#202733]' : 'border-black/5 bg-[#ece7df]')}>
                              {imageSlot.imageUrl ? (
                                <div className="relative h-full w-full overflow-hidden">
                                  <img
                                    src={imageSlot.imageUrl}
                                    aria-hidden
                                    alt=""
                                    className="absolute inset-0 h-full w-full object-cover"
                                    style={{ filter: 'blur(26px) brightness(0.72)', transform: 'scale(1.08)' }}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10" />
                                  <div className="relative flex h-full w-full items-center justify-center p-4 md:p-5">
                                    <img
                                      src={imageSlot.imageUrl}
                                      alt={imageSlot.label}
                                      className="max-h-full max-w-full rounded-[18px] object-contain shadow-[0_18px_38px_rgba(0,0,0,0.18)]"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className={cn('flex h-full items-center justify-center text-sm text-gray-400', isDarkMode && 'text-[#aeb8c6]')}>
                                  Geen afbeelding beschikbaar
                                </div>
                              )}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openFilePicker(slide.id, imageSlot.role)}
                                className={cn('inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors', isDarkMode ? 'border-white/15 bg-[#343d4b] text-[#e7edf7] hover:bg-[#404b5d]' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')}
                              >
                                {uploadingTarget === imageSlot.inputKey ? <Upload size={15} /> : <ImagePlus size={15} />}
                                {uploadingTarget === imageSlot.inputKey ? 'Uploaden...' : 'Nieuwe afbeelding'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onResetImage(slide.id, imageSlot.role)}
                                disabled={!imageSlot.customImageUrl}
                                className={cn(
                                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                                  imageSlot.customImageUrl
                                    ? (isDarkMode ? 'border-white/15 bg-[#343d4b] text-[#d4dce8] hover:bg-[#404b5d]' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')
                                    : (isDarkMode ? 'cursor-not-allowed border-white/10 bg-[#2a3240] text-[#77849a]' : 'cursor-not-allowed border-gray-200 bg-white text-gray-300')
                                )}
                              >
                                <RotateCcw size={15} />
                                Gebruik standaard
                              </button>
                            </div>

                            <input
                              ref={(node) => setFileInputRef(imageSlot.inputKey, node)}
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.currentTarget.value = '';
                                if (!file) return;
                                void onUploadImage(slide.id, imageSlot.role, file);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};