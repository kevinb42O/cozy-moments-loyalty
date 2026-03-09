import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IDLE_TIMEOUT_MS,
  createDefaultScreensaverSlides,
  normalizeScreensaverConfig,
  resolvePrimarySlideImage,
  resolveSecondarySlideImage,
  type ScreensaverSlideConfig,
} from '../../shared/lib/screensaver-config';

// ── Ken Burns keyframes (random-ish per render to avoid burn-in) ─────────────
const kenBurnsVariants = (seed: number, durationMs: number) => {
  const origins = ['center', 'top left', 'top right', 'bottom left', 'bottom right'];
  const origin = origins[seed % origins.length];
  return {
    initial: { scale: 1, transformOrigin: origin },
    animate: {
      scale: [1, 1.15],
      transformOrigin: origin,
      transition: { duration: durationMs / 1000, ease: 'linear' as const },
    },
  };
};

// ── Dual-slide scene: two images slide in, back one comes forward after 5s ───
const DualSlideScene: React.FC<{
  leftImg: string;
  rightImg: string;
  idx: number;
  durationMs: number;
}> = ({ leftImg, rightImg, idx, durationMs }) => {
  const kbL = kenBurnsVariants(idx + 2, durationMs);
  const kbR = kenBurnsVariants(idx + 5, durationMs);
  const durationSeconds = durationMs / 1000;

  // Timings: slide-in ~1.4s, then at 5s the back image comes to front
  const SWAP_DELAY = Math.min(5, Math.max(3.2, durationSeconds * 0.35));
  const SWAP_DUR = 1.2; // smooth transition duration

  return (
    <div className="absolute inset-0 bg-white overflow-hidden flex items-center justify-center">
      {/* Left image — starts in front (z-20), goes behind at 5s (z-5) */}
      <motion.div
        className="absolute left-0 top-[5%] w-[58%] h-[90%]"
        initial={{ x: '-110%', rotate: -4, zIndex: 20, scale: 1 }}
        animate={{
          x: '8%',
          rotate: -1.5,
          zIndex: [20, 20, 5],
          scale: [1, 1, 0.97],
        }}
        transition={{
          x: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
          rotate: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
          zIndex: { times: [0, SWAP_DELAY / durationSeconds, (SWAP_DELAY + 0.1) / durationSeconds], duration: durationSeconds, ease: 'linear' },
          scale: { times: [0, SWAP_DELAY / durationSeconds, (SWAP_DELAY + SWAP_DUR) / durationSeconds], duration: durationSeconds, ease: 'easeInOut' },
        }}
      >
        <motion.img
          src={leftImg}
          alt=""
          className="w-full h-full object-cover rounded-[32px] shadow-2xl"
          {...kbL}
        />
      </motion.div>

      {/* Right image — starts behind (z-10), comes to front at 5s (z-30) */}
      <motion.div
        className="absolute right-0 top-[8%] w-[55%] h-[85%]"
        initial={{ x: '110%', rotate: 4, zIndex: 10, scale: 1 }}
        animate={{
          x: '-8%',
          rotate: 1.5,
          zIndex: [10, 10, 30],
          scale: [1, 1, 1.04],
        }}
        transition={{
          x: { duration: 1.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] },
          rotate: { duration: 1.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] },
          zIndex: { times: [0, SWAP_DELAY / durationSeconds, (SWAP_DELAY + 0.1) / durationSeconds], duration: durationSeconds, ease: 'linear' },
          scale: { times: [0, SWAP_DELAY / durationSeconds, (SWAP_DELAY + SWAP_DUR) / durationSeconds], duration: durationSeconds, ease: 'easeInOut' },
        }}
      >
        <motion.img
          src={rightImg}
          alt=""
          className="w-full h-full object-cover rounded-[32px] shadow-2xl"
          {...kbR}
        />
      </motion.div>

      {/* Soft center blend so overlap looks intentional */}
      <div className="absolute inset-0 pointer-events-none z-40 bg-radial-[at_50%_50%] from-white/40 via-transparent to-transparent" />
    </div>
  );
};

// ── Single-image scene: blurred background fill + contained hero with Ken Burns
// Dynamically handles any aspect ratio — portrait, landscape, square — perfectly.
const SingleScrollScene: React.FC<{ img: string; idx: number; durationMs: number }> = ({ img, idx, durationMs }) => {
  // Vary pan direction per slide so all 5 single-image slides feel different
  const panVariants = [
    { x: ['3%', '-3%'],   y: ['2%', '-2%']  },  // idx 0: right→left, down→up
    { x: ['-3%', '3%'],  y: ['-2%', '2%']  },  // idx 1: left→right, up→down
    { x: ['0%', '0%'],   y: ['3%', '-3%']  },  // idx 2: straight up
    { x: ['3%', '-3%'],  y: ['-2%', '2%']  },  // idx 3: diagonal
    { x: ['-3%', '3%'],  y: ['2%', '-2%']  },  // idx 4: diagonal opposite
  ];
  const pan = panVariants[idx % panVariants.length];

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* ── Blurred background: always fills the screen, handles any aspect ratio ── */}
      <img
        src={img}
        aria-hidden
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scale(1.12)', filter: 'blur(28px) brightness(0.38) saturate(1.5)' }}
      />

      {/* ── Warm dark gradient overlay for depth ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(10,6,4,0.55) 100%)' }}
      />

      {/* ── Hero image: perfectly contained, dynamic Ken Burns pan ── */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        style={{ padding: '4vh 4vw' }}
        initial={{ scale: 1, x: pan.x[0], y: pan.y[0] }}
        animate={{ scale: 1.07, x: pan.x[1], y: pan.y[1] }}
        transition={{ duration: durationMs / 1000, ease: 'linear' }}
      >
        <img
          src={img}
          alt=""
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '24px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.4)',
          }}
        />
      </motion.div>
    </div>
  );
};

const SceneRenderer: React.FC<{
  sceneIndex: number;
  loopCount: number;
  slides: ScreensaverSlideConfig[];
}> = ({ sceneIndex, loopCount, slides }) => {
  const totalScenes = slides.length;
  const slide = slides[sceneIndex % totalScenes];
  const idx = loopCount * totalScenes + sceneIndex;
  const primaryImage = resolvePrimarySlideImage(slide);
  const secondaryImage = resolveSecondarySlideImage(slide);

  if (slide.mode === 'dual' && secondaryImage) {
    return <DualSlideScene leftImg={primaryImage} rightImg={secondaryImage} idx={idx} durationMs={slide.durationMs} />;
  }

  return <SingleScrollScene img={primaryImage} idx={idx} durationMs={slide.durationMs} />;
};

// ── Main Screensaver Component ───────────────────────────────────────────────
export const Screensaver: React.FC<{
  onWake: () => void;
  slides?: ScreensaverSlideConfig[];
  previewRequest?: number;
}> = ({ onWake, slides, previewRequest }) => {
  const [active, setActive] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderedSlides = useMemo(
    () => normalizeScreensaverConfig(slides ?? createDefaultScreensaverSlides()),
    [slides]
  );
  const currentSlide = orderedSlides[sceneIndex] ?? orderedSlides[0];
  const totalScenes = orderedSlides.length;

  // ── Reset idle timer ───────────────────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActive(true);
      setSceneIndex(0);
      setLoopCount(prev => prev + 1);
    }, IDLE_TIMEOUT_MS);
  }, []);

  // ── Wake handler ───────────────────────────────────────────────────────────
  const wake = useCallback(() => {
    if (active) {
      setActive(false);
      if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
      onWake();
    }
    resetIdleTimer();
  }, [active, onWake, resetIdleTimer]);

  // ── Listen for user activity ───────────────────────────────────────────────
  useEffect(() => {
    const events = ['touchstart', 'mousemove', 'click', 'keydown', 'scroll'] as const;
    const handler = () => wake();

    events.forEach(evt => window.addEventListener(evt, handler, { passive: true }));
    resetIdleTimer();

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [wake, resetIdleTimer]);

  useEffect(() => {
    if (!previewRequest) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);

    setActive(true);
    setSceneIndex(0);
    setLoopCount(prev => prev + 1);
  }, [previewRequest]);

  // ── Scene rotation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !currentSlide) return;
    sceneTimerRef.current = setTimeout(() => {
      setSceneIndex(prev => {
        const next = prev + 1;
        if (next >= totalScenes) {
          setLoopCount(lc => lc + 1);
          return 0;
        }
        return next;
      });
    }, currentSlide.durationMs);

    return () => {
      if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
    };
  }, [active, currentSlide, totalScenes]);

  useEffect(() => {
    if (sceneIndex < totalScenes) return;
    setSceneIndex(0);
  }, [sceneIndex, totalScenes]);

  // ── Preload images on mount ────────────────────────────────────────────────
  useEffect(() => {
    orderedSlides.flatMap((slide) => {
      const urls = [resolvePrimarySlideImage(slide)];
      const secondaryImage = resolveSecondarySlideImage(slide);
      if (secondaryImage) urls.push(secondaryImage);
      return urls;
    }).forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, [orderedSlides]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="screensaver"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[9999] bg-white cursor-pointer"
          onTouchStart={wake}
          onClick={wake}
        >
          {/* Full-screen scene container — no static elements to avoid burn-in */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`scene-${sceneIndex}-${loopCount}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0 }}
              className="absolute inset-0"
            >
              <SceneRenderer sceneIndex={sceneIndex} loopCount={loopCount} slides={orderedSlides} />
            </motion.div>
          </AnimatePresence>

          {/* Subtle "tap to dismiss" hint — fades after 3s, moves around to prevent burn-in */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0.5, 0] }}
            transition={{ duration: 4, times: [0, 0.1, 0.7, 1] }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/30 backdrop-blur-sm text-white/90 px-6 py-2 rounded-full text-sm font-medium pointer-events-none"
          >
            Tik om te sluiten
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
