export const IDLE_TIMEOUT_MS = 60_000;
export const SCREENSAVER_STORAGE_BUCKET = 'screensaver-assets';
export const SCREENSAVER_SLIDE_COUNT = 9;
export const DEFAULT_SLIDE_DURATION_MS = 18_000;
export const MIN_SLIDE_DURATION_MS = 6_000;
export const MAX_SLIDE_DURATION_MS = 45_000;
export const MAX_SCREENAVER_UPLOAD_FILE_SIZE_BYTES = 8 * 1024 * 1024;
export const MIN_SCREENSAVER_UPLOAD_SHORT_SIDE_PX = 900;
export const MAX_SCREENSAVER_UPLOAD_LONG_SIDE_PX = 5000;
export const MAX_SCREENSAVER_UPLOAD_TOTAL_PIXELS = 20_000_000;

export type ScreensaverSlideMode = 'single' | 'dual';
export type ScreensaverImageRole = 'primary' | 'secondary';

type ScreensaverSlideDefinition = {
  id: string;
  title: string;
  mode: ScreensaverSlideMode;
  defaultPrimaryImageUrl: string;
  defaultSecondaryImageUrl: string | null;
};

export type StoredScreensaverSlideConfig = {
  id: string;
  order: number;
  durationMs: number;
  swapSides: boolean;
  customPrimaryImageUrl: string | null;
  customSecondaryImageUrl: string | null;
};

export type ScreensaverSlideConfig = ScreensaverSlideDefinition & StoredScreensaverSlideConfig;

const SCREENSAVER_SLIDE_DEFINITIONS: readonly ScreensaverSlideDefinition[] = [
  {
    id: 'slide-1',
    title: 'Sfeerbeeld 1',
    mode: 'dual',
    defaultPrimaryImageUrl: '/cozy1.jpg',
    defaultSecondaryImageUrl: '/cozy2.png',
  },
  {
    id: 'slide-2',
    title: 'Sfeerbeeld 2',
    mode: 'single',
    defaultPrimaryImageUrl: '/cozy3.png',
    defaultSecondaryImageUrl: null,
  },
  {
    id: 'slide-3',
    title: 'Sfeerbeeld 3',
    mode: 'dual',
    defaultPrimaryImageUrl: '/cozy4.webp',
    defaultSecondaryImageUrl: '/cozy5.png',
  },
  {
    id: 'slide-4',
    title: 'Sfeerbeeld 4',
    mode: 'dual',
    defaultPrimaryImageUrl: '/cozy6.png',
    defaultSecondaryImageUrl: '/cozy7.png',
  },
  {
    id: 'slide-5',
    title: 'Sfeerbeeld 5',
    mode: 'dual',
    defaultPrimaryImageUrl: '/cozy8.png',
    defaultSecondaryImageUrl: '/cozy9.png',
  },
  {
    id: 'slide-6',
    title: 'Sfeerbeeld 6',
    mode: 'single',
    defaultPrimaryImageUrl: '/cozy10.jpg',
    defaultSecondaryImageUrl: null,
  },
  {
    id: 'slide-7',
    title: 'Sfeerbeeld 7',
    mode: 'single',
    defaultPrimaryImageUrl: '/cozy11.jpg',
    defaultSecondaryImageUrl: null,
  },
  {
    id: 'slide-8',
    title: 'Sfeerbeeld 8',
    mode: 'single',
    defaultPrimaryImageUrl: '/cozy12.jpg',
    defaultSecondaryImageUrl: null,
  },
  {
    id: 'slide-9',
    title: 'Sfeerbeeld 9',
    mode: 'single',
    defaultPrimaryImageUrl: '/cozy13.jpg',
    defaultSecondaryImageUrl: null,
  },
] as const;

function clampDuration(durationMs: unknown) {
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs)) return DEFAULT_SLIDE_DURATION_MS;
  return Math.max(MIN_SLIDE_DURATION_MS, Math.min(MAX_SLIDE_DURATION_MS, Math.round(durationMs)));
}

function normalizeStoredUrl(url: unknown) {
  return typeof url === 'string' && url.trim().length > 0 ? url : null;
}

function normalizeSlideOrder(slides: ScreensaverSlideConfig[]) {
  return [...slides]
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title))
    .map((slide, index) => ({ ...slide, order: index }));
}

export function createDefaultScreensaverSlides() {
  return SCREENSAVER_SLIDE_DEFINITIONS.map((definition, index) => ({
    ...definition,
    order: index,
    durationMs: DEFAULT_SLIDE_DURATION_MS,
    swapSides: false,
    customPrimaryImageUrl: null,
    customSecondaryImageUrl: null,
  }));
}

export function normalizeScreensaverConfig(value: unknown) {
  const storedSlides = Array.isArray(value) ? value : [];
  const slideMap = new Map<string, Record<string, unknown>>();

  storedSlides.forEach((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.id !== 'string') return;
    if (slideMap.has(candidate.id)) return;
    slideMap.set(candidate.id, candidate);
  });

  const mergedSlides = SCREENSAVER_SLIDE_DEFINITIONS.map((definition, index) => {
    const stored = slideMap.get(definition.id);

    return {
      ...definition,
      order: typeof stored?.order === 'number' ? stored.order : index,
      durationMs: clampDuration(stored?.durationMs),
      swapSides: definition.mode === 'dual' ? stored?.swapSides === true : false,
      customPrimaryImageUrl: normalizeStoredUrl(stored?.customPrimaryImageUrl),
      customSecondaryImageUrl: definition.mode === 'dual'
        ? normalizeStoredUrl(stored?.customSecondaryImageUrl)
        : null,
    };
  });

  return normalizeSlideOrder(mergedSlides);
}

export function serializeScreensaverConfig(slides: ScreensaverSlideConfig[]) {
  return normalizeSlideOrder(slides).map((slide) => ({
    id: slide.id,
    order: slide.order,
    durationMs: clampDuration(slide.durationMs),
    swapSides: slide.mode === 'dual' ? slide.swapSides === true : false,
    customPrimaryImageUrl: normalizeStoredUrl(slide.customPrimaryImageUrl),
    customSecondaryImageUrl: slide.mode === 'dual'
      ? normalizeStoredUrl(slide.customSecondaryImageUrl)
      : null,
  } satisfies StoredScreensaverSlideConfig));
}

export function reorderScreensaverSlides(slides: ScreensaverSlideConfig[], slideId: string, direction: -1 | 1) {
  const orderedSlides = normalizeSlideOrder(slides);
  const currentIndex = orderedSlides.findIndex((slide) => slide.id === slideId);
  const nextIndex = currentIndex + direction;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedSlides.length) {
    return orderedSlides;
  }

  const nextSlides = [...orderedSlides];
  const [movedSlide] = nextSlides.splice(currentIndex, 1);
  nextSlides.splice(nextIndex, 0, movedSlide);

  return nextSlides.map((slide, index) => ({ ...slide, order: index }));
}

export function resetScreensaverSlidesToDefaults() {
  return createDefaultScreensaverSlides();
}

export function resolvePrimarySlideImage(slide: ScreensaverSlideConfig) {
  return slide.customPrimaryImageUrl || slide.defaultPrimaryImageUrl;
}

export function resolveSecondarySlideImage(slide: ScreensaverSlideConfig) {
  if (slide.mode !== 'dual') return null;
  return slide.customSecondaryImageUrl || slide.defaultSecondaryImageUrl;
}

export function resolveLeftSlideImage(slide: ScreensaverSlideConfig) {
  const primaryImage = resolvePrimarySlideImage(slide);
  const secondaryImage = resolveSecondarySlideImage(slide);

  if (slide.mode !== 'dual' || !secondaryImage) return primaryImage;
  return slide.swapSides ? secondaryImage : primaryImage;
}

export function resolveRightSlideImage(slide: ScreensaverSlideConfig) {
  const primaryImage = resolvePrimarySlideImage(slide);
  const secondaryImage = resolveSecondarySlideImage(slide);

  if (slide.mode !== 'dual') return null;
  if (!secondaryImage) return null;
  return slide.swapSides ? primaryImage : secondaryImage;
}

export function getScreensaverStoragePath(slideId: string, role: ScreensaverImageRole) {
  return `${slideId}-${role}.webp`;
}