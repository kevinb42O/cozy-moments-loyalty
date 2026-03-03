import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Image paths ──────────────────────────────────────────────────────────────
const IMAGES = {
  cozy1: '/cozy1.jpg',
  cozy2: '/cozy2.png',
  cozy3: '/cozy3.png',
  cozy4: '/cozy4.webp',
  cozy5: '/cozy5.png',
  cozy6: '/cozy6.png',
  cozy7: '/cozy7.png',
  cozy8: '/cozy8.png',
  cozy9: '/cozy9.png',
};

// ── Config ───────────────────────────────────────────────────────────────────
const IDLE_TIMEOUT = 60_000;       // 60s before screensaver activates
const SCENE_DURATION = 18_000;     // 18s per scene
const TOTAL_SCENES = 5;

// ── Ken Burns keyframes (random-ish per render to avoid burn-in) ─────────────
const kenBurnsVariants = (seed: number) => {
  const origins = ['center', 'top left', 'top right', 'bottom left', 'bottom right'];
  const origin = origins[seed % origins.length];
  return {
    initial: { scale: 1, transformOrigin: origin },
    animate: {
      scale: [1, 1.15],
      transformOrigin: origin,
      transition: { duration: SCENE_DURATION / 1000, ease: 'linear' },
    },
  };
};

// ── Dual-slide scene: two images slide in from opposite sides ────────────────
const DualSlideScene: React.FC<{
  leftImg: string;
  rightImg: string;
  idx: number;
}> = ({ leftImg, rightImg, idx }) => {
  const kbL = kenBurnsVariants(idx + 2);
  const kbR = kenBurnsVariants(idx + 5);
  return (
    <div className="absolute inset-0 bg-white overflow-hidden flex items-center justify-center">
      {/* Left image — slides in from far left to ~1/3 center */}
      <motion.div
        className="absolute left-0 top-[5%] w-[58%] h-[90%]"
        initial={{ x: '-110%', rotate: -4 }}
        animate={{ x: '8%', rotate: -1.5 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.img
          src={leftImg}
          alt=""
          className="w-full h-full object-cover rounded-[32px] shadow-2xl"
          {...kbL}
        />
      </motion.div>

      {/* Right image — slides in from far right to ~2/3 center */}
      <motion.div
        className="absolute right-0 top-[8%] w-[55%] h-[85%]"
        initial={{ x: '110%', rotate: 4 }}
        animate={{ x: '-8%', rotate: 1.5 }}
        transition={{ duration: 1.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.img
          src={rightImg}
          alt=""
          className="w-full h-full object-cover rounded-[32px] shadow-2xl"
          {...kbR}
        />
      </motion.div>

      {/* Soft center blend so overlap looks intentional */}
      <div className="absolute inset-0 pointer-events-none bg-radial-[at_50%_50%] from-white/40 via-transparent to-transparent" />
    </div>
  );
};

// ── Single-image scroll scene: one large image slowly pans across ────────────
const SingleScrollScene: React.FC<{ img: string; idx: number }> = ({ img, idx }) => {
  const kb = kenBurnsVariants(idx + 3);
  return (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <motion.div
        className="absolute inset-[-10%] w-[120%] h-[120%]"
        initial={{ x: '5%', y: '5%' }}
        animate={{ x: '-5%', y: '-3%' }}
        transition={{ duration: SCENE_DURATION / 1000, ease: 'linear' }}
      >
        <motion.img
          src={img}
          alt=""
          className="w-full h-full object-cover"
          {...kb}
        />
      </motion.div>
    </div>
  );
};

// ── Scene list: dual-slide pairs + single-scroll for cozy3 ──────────────────
const SCENES: React.FC<{ idx: number }>[] = [
  // Scene 0: cozy1 + cozy2 — dual slide (same style as scenes 2-4)
  ({ idx }) => <DualSlideScene leftImg={IMAGES.cozy1} rightImg={IMAGES.cozy2} idx={idx} />,
  // Scene 1: cozy3 — single image scroll
  ({ idx }) => <SingleScrollScene img={IMAGES.cozy3} idx={idx} />,
  // Scene 2: cozy5 + cozy6
  ({ idx }) => <DualSlideScene leftImg={IMAGES.cozy5} rightImg={IMAGES.cozy6} idx={idx} />,
  // Scene 3: cozy7 + cozy8
  ({ idx }) => <DualSlideScene leftImg={IMAGES.cozy7} rightImg={IMAGES.cozy8} idx={idx} />,
  // Scene 4: cozy9 + cozy4
  ({ idx }) => <DualSlideScene leftImg={IMAGES.cozy9} rightImg={IMAGES.cozy4} idx={idx} />,
];

// ── Scene renderer ───────────────────────────────────────────────────────────

const SceneRenderer: React.FC<{ sceneIndex: number; loopCount: number }> = ({ sceneIndex, loopCount }) => {
  const SceneComponent = SCENES[sceneIndex % TOTAL_SCENES];
  const idx = loopCount * TOTAL_SCENES + sceneIndex; // unique seed per iteration
  return <SceneComponent idx={idx} />;
};

// ── Main Screensaver Component ───────────────────────────────────────────────
export const Screensaver: React.FC<{ onWake: () => void }> = ({ onWake }) => {
  const [active, setActive] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Reset idle timer ───────────────────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActive(true);
      setSceneIndex(0);
      setLoopCount(prev => prev + 1);
    }, IDLE_TIMEOUT);
  }, []);

  // ── Wake handler ───────────────────────────────────────────────────────────
  const wake = useCallback(() => {
    if (active) {
      setActive(false);
      if (sceneTimerRef.current) clearInterval(sceneTimerRef.current);
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

  // ── Scene rotation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    sceneTimerRef.current = setInterval(() => {
      setSceneIndex(prev => {
        const next = prev + 1;
        if (next >= TOTAL_SCENES) {
          setLoopCount(lc => lc + 1);
          return 0;
        }
        return next;
      });
    }, SCENE_DURATION);

    return () => {
      if (sceneTimerRef.current) clearInterval(sceneTimerRef.current);
    };
  }, [active]);

  // ── Preload images on mount ────────────────────────────────────────────────
  useEffect(() => {
    Object.values(IMAGES).forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

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
              <SceneRenderer sceneIndex={sceneIndex} loopCount={loopCount} />
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
