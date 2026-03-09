import {
  createDefaultScreensaverSlides,
  normalizeScreensaverConfig,
  resolvePrimarySlideImage,
  resolveSecondarySlideImage,
  serializeScreensaverConfig,
  type ScreensaverSlideConfig,
} from './screensaver-config';

const SCREENSAVER_CONFIG_CACHE_KEY = 'cozy:screensaver-config:v1';
const SCREENSAVER_IMAGE_CACHE = 'cozy-screensaver-images-v1';

export function loadCachedScreensaverSlides() {
  if (typeof window === 'undefined') return createDefaultScreensaverSlides();

  try {
    const rawValue = window.localStorage.getItem(SCREENSAVER_CONFIG_CACHE_KEY);
    if (!rawValue) return createDefaultScreensaverSlides();
    return normalizeScreensaverConfig(JSON.parse(rawValue));
  } catch {
    return createDefaultScreensaverSlides();
  }
}

export function persistCachedScreensaverSlides(slides: ScreensaverSlideConfig[]) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      SCREENSAVER_CONFIG_CACHE_KEY,
      JSON.stringify(serializeScreensaverConfig(slides))
    );
  } catch {
    // Ignore quota/private-mode failures; network-backed config remains authoritative.
  }
}

export async function warmScreensaverImageCache(slides: ScreensaverSlideConfig[]) {
  if (typeof window === 'undefined') return;

  const urls = [...new Set(
    slides.flatMap((slide) => {
      const imageUrls = [resolvePrimarySlideImage(slide)];
      const secondaryImage = resolveSecondarySlideImage(slide);
      if (secondaryImage) imageUrls.push(secondaryImage);
      return imageUrls;
    }).filter(Boolean)
  )];

  urls.forEach((url) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  });

  if (!('caches' in window)) return;

  try {
    const cache = await window.caches.open(SCREENSAVER_IMAGE_CACHE);
    await Promise.all(urls.map(async (url) => {
      try {
        const existing = await cache.match(url, { ignoreSearch: false });
        if (existing) return;

        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) return;
        await cache.put(url, response.clone());
      } catch {
        // Best effort only.
      }
    }));
  } catch {
    // Cache API may be unavailable in some embedded browsers.
  }
}