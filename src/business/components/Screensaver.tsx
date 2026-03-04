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
  cozy10: '/cozy10.jpg',
  cozy11: '/cozy11.jpg',
  cozy12: '/cozy12.jpg',
  cozy13: '/cozy13.jpg',
};

// ── Config ───────────────────────────────────────────────────────────────────
const IDLE_TIMEOUT = 60_000;       // 60s before screensaver activates
const SCENE_DURATION = 18_000;     // 18s per scene
const TOTAL_SCENES = 9;

// ── Ken Burns keyframes (random-ish per render to avoid burn-in) ─────────────
const kenBurnsVariants = (seed: number) => {
  const origins = ['center', 'top left', 'top right', 'bottom left', 'bottom right'];
  const origin = origins[seed % origins.length];
  return {
    initial: { scale: 1, transformOrigin: origin },
    animate: {
      scale: [1, 1.15],
      transformOrigin: origin,
      transition: { duration: SCENE_DURATION / 1000, ease: 'linear' as const },
    },
  };
};

// ── Dual-slide scene: two images slide in, back one comes forward after 5s ───
const DualSlideScene: React.FC<{
  leftImg: string;
  rightImg: string;
  idx: number;
}> = ({ leftImg, rightImg, idx }) => {
  const kbL = kenBurnsVariants(idx + 2);
  const kbR = kenBurnsVariants(idx + 5);

  // Timings: slide-in ~1.4s, then at 5s the back image comes to front
  const SWAP_DELAY = 5; // seconds
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
          zIndex: { times: [0, SWAP_DELAY / 18, (SWAP_DELAY + 0.1) / 18], duration: 18, ease: 'linear' },
          scale: { times: [0, SWAP_DELAY / 18, (SWAP_DELAY + SWAP_DUR) / 18], duration: 18, ease: 'easeInOut' },
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
          zIndex: { times: [0, SWAP_DELAY / 18, (SWAP_DELAY + 0.1) / 18], duration: 18, ease: 'linear' },
          scale: { times: [0, SWAP_DELAY / 18, (SWAP_DELAY + SWAP_DUR) / 18], duration: 18, ease: 'easeInOut' },
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
const SingleScrollScene: React.FC<{ img: string; idx: number }> = ({ img, idx }) => {
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
        transition={{ duration: SCENE_DURATION / 1000, ease: 'linear' }}
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

// ── Scene list: correct product description + product photo pairs ────────────
const SCENES: React.FC<{ idx: number }>[] = [
  // Scene 0: cozy1 (description) + cozy2 (photo)
  ({ idx }) => <DualSlideScene leftImg={IMAGES.cozy1} rightImg={IMAGES.cozy2} idx={idx} />,
  // Scene 1: cozy3 — single image scroll
  ({ idx }) => <SingleScrollScene img={IMAGES.cozy3} idx={idx} />,
  // Scene 2: cozy4 (description) + cozy5 (photo)
  ({ idx }) => <DualSlideScene leftImg={IMAGES.cozy4} rightImg={IMAGES.cozy5} idx={idx} />,
  // Scene 3: cozy6 (description) + cozy7 (photo)
  ({ idx }) => <DualSlideScene leftImg={IMAGES.cozy6} rightImg={IMAGES.cozy7} idx={idx} />,
  // Scene 4: cozy8 (description) + cozy9 (photo)
  ({ idx }) => <DualSlideScene leftImg={IMAGES.cozy8} rightImg={IMAGES.cozy9} idx={idx} />,
  // Scene 5: cozy10 — single image scroll
  ({ idx }) => <SingleScrollScene img={IMAGES.cozy10} idx={idx} />,
  // Scene 6: cozy11 — single image scroll
  ({ idx }) => <SingleScrollScene img={IMAGES.cozy11} idx={idx} />,
  // Scene 7: cozy12 — single image scroll
  ({ idx }) => <SingleScrollScene img={IMAGES.cozy12} idx={idx} />,
  // Scene 8: cozy13 — single image scroll
  ({ idx }) => <SingleScrollScene img={IMAGES.cozy13} idx={idx} />,
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
