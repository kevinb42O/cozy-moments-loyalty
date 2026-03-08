import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, CheckCircle, Camera, RefreshCw, Gift, Sparkles } from 'lucide-react';
import { useLoyalty, CardType, cardTypeLabels } from '../../shared/store/LoyaltyContext';
import { LoyaltyCard } from '../../shared/components/LoyaltyCard';
import { verifyQrPayload } from '../../shared/lib/qr-crypto';
import { motion, AnimatePresence } from 'framer-motion';

type PermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

interface ScanResult {
  type: 'add' | 'redeem';
  earned?: Record<CardType, number>;
  claimedType?: CardType;
  bonusApplied?: boolean;
  bonusType?: CardType;
}

// Module-level AudioContext that gets unlocked on user tap and reused for chimes.
// Mobile browsers (iOS/Android) block AudioContext unless created during a user gesture.
let unlockedAudioCtx: AudioContext | null = null;

function unlockAudio() {
  try {
    if (!unlockedAudioCtx || unlockedAudioCtx.state === 'closed') {
      unlockedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (unlockedAudioCtx.state === 'suspended') {
      unlockedAudioCtx.resume();
    }
  } catch { /* ignore */ }
}

async function playSuccessChime() {
  try {
    // If no context yet, try creating one (last-resort — may be blocked on iOS without gesture)
    if (!unlockedAudioCtx || unlockedAudioCtx.state === 'closed') {
      unlockedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = unlockedAudioCtx;
    // MUST await resume — stopping the camera stream can suspend the context on iOS
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const notes = [
      { freq: 880,  start: 0,    duration: 0.18 },
      { freq: 1320, start: 0.16, duration: 0.30 },
    ];
    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    });
  } catch { /* ignore */ }
}

function getDeviceInstructions(): { browser: string; steps: string[] } {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isSamsungBrowser = /SamsungBrowser/.test(ua);

  if (isIOS && isSafari) {
    return {
      browser: 'Safari op iPhone/iPad',
      steps: [
        'Ga naar Instellingen op je iPhone',
        'Scroll naar beneden en tik op "Safari"',
        'Tik op "Camera"',
        'Kies "Toestaan"',
        'Kom terug en probeer opnieuw',
      ],
    };
  }
  if (isIOS) {
    return {
      browser: 'Chrome op iPhone/iPad',
      steps: [
        'Ga naar Instellingen op je iPhone',
        'Scroll naar beneden en tik op "Chrome"',
        'Tik op "Camera" en zet het aan',
        'Kom terug en probeer opnieuw',
      ],
    };
  }
  if (isSamsungBrowser) {
    return {
      browser: 'Samsung Internet',
      steps: [
        'Tik op het slotje of ⓘ in de adresbalk',
        'Tik op "Machtigingen"',
        'Zet "Camera" op "Toestaan"',
        'Herlaad de pagina en probeer opnieuw',
      ],
    };
  }
  if (isFirefox) {
    return {
      browser: 'Firefox',
      steps: [
        'Tik op het slotje in de adresbalk',
        'Tik op "Verbindingsinfo"',
        'Tik op "Machtigingen wijzigen"',
        'Zet "Camera gebruiken" op "Toestaan"',
        'Herlaad de pagina en probeer opnieuw',
      ],
    };
  }
  // Default: Chrome / Android
  return {
    browser: 'Chrome',
    steps: [
      'Tik op het slotje 🔒 links in de adresbalk',
      'Tik op "Machtigingen"',
      'Zet "Camera" op "Toestaan"',
      'Herlaad de pagina en probeer opnieuw',
    ],
  };
}

export const Scanner: React.FC = () => {
  const navigate = useNavigate();
  const { currentCustomer, addConsumptions, claimReward } = useLoyalty();
  const [permission, setPermission] = useState<PermissionState>('idle');
  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const startingRef = useRef(false);

  // Unlock AudioContext on the very first interaction with this page
  // (needed for returning users who auto-start camera via sessionStorage)
  useEffect(() => {
    const handler = () => { unlockAudio(); };
    window.addEventListener('touchstart', handler, { once: true, passive: true });
    window.addEventListener('click', handler, { once: true, passive: true });
    return () => {
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('click', handler);
    };
  }, []);

  // Check if camera permission was already granted/denied before asking.
  // We use sessionStorage as primary fallback because navigator.permissions
  // is unreliable on iOS Safari and throws on many Android browsers.
  useEffect(() => {
    if (!window.isSecureContext) { setPermission('unavailable'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setPermission('unavailable'); return; }

    // If we already granted in this session, skip the idle screen entirely
    if (sessionStorage.getItem('camera-granted') === '1') {
      setPermission('granted');
      return;
    }

    // Try the permissions API as a secondary check
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then(result => {
          if (result.state === 'granted') {
            sessionStorage.setItem('camera-granted', '1');
            setPermission('granted');
          } else if (result.state === 'denied') {
            setPermission('denied');
          }
        })
        .catch(() => { /* not supported — stay on idle */ });
    }
  }, []);

  // Reliably stop + clear the scanner and fully recreate the #reader DOM node.
  // Simply wiping innerHTML is not enough — Html5Qrcode keeps internal state
  // tied to the element ID, so we replace the node entirely.
  const stopAndClear = useCallback(async () => {
    const instance = scannerRef.current;
    if (instance) {
      try {
        if (isRunningRef.current) {
          await instance.stop();
          isRunningRef.current = false;
        }
        await instance.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    // Replace the #reader node entirely so Html5Qrcode starts completely fresh
    const el = document.getElementById('reader');
    if (el && el.parentNode) {
      const fresh = document.createElement('div');
      fresh.id = 'reader';
      fresh.className = el.className;
      el.parentNode.replaceChild(fresh, el);
    }
  }, []);

  const startCamera = useCallback(async () => {
    // Unlock AudioContext NOW — this is the user gesture, so iOS/Android will allow it
    unlockAudio();
    setPermission('requesting');
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      setPermission('denied');
      return;
    }
    // Stop the probe stream — the QR scanner will open its own
    if (stream) stream.getTracks().forEach(t => t.stop());
    sessionStorage.setItem('camera-granted', '1');
    setPermission('granted');
  }, []);

  // Start QR scanner once permission is granted.
  // Uses DOM polling + retry with exponential backoff for 100% reliability.
  useEffect(() => {
    if (permission !== 'granted' || scanned) return;

    let cancelled = false;
    let retryCount = 0;
    const MAX_RETRIES = 4;

    // Poll for DOM element instead of arbitrary timeout
    const waitForReader = (timeoutMs: number): Promise<boolean> =>
      new Promise(resolve => {
        if (document.getElementById('reader')) { resolve(true); return; }
        const start = Date.now();
        const iv = setInterval(() => {
          if (document.getElementById('reader')) { clearInterval(iv); resolve(true); return; }
          if (Date.now() - start > timeoutMs) { clearInterval(iv); resolve(false); }
        }, 30);
      });

    const attemptStart = async (): Promise<void> => {
      if (cancelled || startingRef.current || isRunningRef.current) return;
      startingRef.current = true;

      try {
        // Wait for #reader to exist in DOM (up to 2s)
        const found = await waitForReader(2000);
        if (cancelled || !found) { startingRef.current = false; return; }

        // Clean up any previous scanner instance
        await stopAndClear();
        if (cancelled) { startingRef.current = false; return; }

        // Give camera hardware time to release after probe stream
        await new Promise(r => setTimeout(r, 200));
        if (cancelled) { startingRef.current = false; return; }

        // Verify #reader still exists after cleanup (stopAndClear replaces node)
        if (!document.getElementById('reader') || cancelled) {
          startingRef.current = false;
          return;
        }

        const html5Qrcode = new Html5Qrcode('reader', false);
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 }, disableFlip: false },
          (decodedText) => {
            verifyQrPayload(decodedText).then(({ valid, payload, error: verifyError }) => {
              if (!valid) {
                setScanError(verifyError || 'Ongeldige QR code');
                setTimeout(() => setScanError(null), 3000);
                return;
              }

              if (!currentCustomer) {
                setScanError('Geen klant geselecteerd');
                setTimeout(() => setScanError(null), 3000);
                return;
              }

              // ── Redeem QR ──
              if (payload.type === 'redeem' && payload.cardType) {
                const cardType = payload.cardType as CardType;
                const txId = typeof payload.txId === 'string' ? payload.txId : undefined;
                const staffEmail = typeof payload.staffEmail === 'string' ? payload.staffEmail : null;
                if (!['coffee', 'wine', 'beer', 'soda'].includes(cardType)) {
                  setScanError('Ongeldige QR code');
                  setTimeout(() => setScanError(null), 3000);
                  return;
                }

                if ((currentCustomer.rewards[cardType] || 0) <= 0) {
                  setScanError(`Geen gratis ${cardTypeLabels[cardType].toLowerCase()} beschikbaar`);
                  setTimeout(() => setScanError(null), 3000);
                  return;
                }

                stopAndClear().then(() => {
                  claimReward(currentCustomer.id, cardType, { txId, staffEmail }).then((ok) => {
                    if (!ok) {
                      setScanError('Deze beloning kon niet worden ingewisseld');
                      setTimeout(() => setScanError(null), 3000);
                      return;
                    }

                    playSuccessChime();
                    setScanResult({ type: 'redeem', claimedType: cardType });
                    setScanned(true);
                    setTimeout(() => navigate('/rewards'), 2500);
                  });
                });
                return;
              }

              // ── Add QR ──
              if (
                payload.coffee !== undefined &&
                payload.wine !== undefined &&
                payload.beer !== undefined
              ) {
                const txId = typeof payload.txId === 'string' ? payload.txId : undefined;
                const staffEmail = typeof payload.staffEmail === 'string' ? payload.staffEmail : null;
                stopAndClear().then(() => {
                  addConsumptions(currentCustomer.id, {
                    coffee: payload.coffee as number,
                    wine: payload.wine as number,
                    beer: payload.beer as number,
                    soda: (payload.soda as number) || 0,
                  }, { txId, staffEmail }).then(result => {
                    playSuccessChime();
                    setScanResult({ type: 'add', earned: result.earned, bonusApplied: result.bonusApplied, bonusType: result.bonusType });
                    setScanned(true);
                    setTimeout(() => navigate('/dashboard'), result.bonusApplied ? 4500 : 2500);
                  }).catch(() => {
                    setScanError('Er ging iets mis bij het opslaan — probeer opnieuw');
                    setTimeout(() => setScanError(null), 4000);
                  });
                });
              } else {
                setScanError('Ongeldige QR code — probeer opnieuw');
                setTimeout(() => setScanError(null), 3000);
              }
            }).catch(() => {
              setScanError('Ongeldige QR code — probeer opnieuw');
              setTimeout(() => setScanError(null), 3000);
            });
          },
          () => { /* ignore per-frame errors */ }
        );

        // Scanner started successfully
        if (cancelled) {
          // Component unmounted while starting — clean up
          try { await html5Qrcode.stop(); } catch { /* ignore */ }
          try { await html5Qrcode.clear(); } catch { /* ignore */ }
          scannerRef.current = null;
        } else {
          isRunningRef.current = true;
        }
        startingRef.current = false;
      } catch {
        // Start failed — retry with exponential backoff
        startingRef.current = false;
        scannerRef.current = null;

        if (!cancelled && retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = Math.min(500 * Math.pow(2, retryCount - 1), 4000);
          await new Promise(r => setTimeout(r, delay));
          if (!cancelled) await attemptStart();
        } else if (!cancelled) {
          // All retries exhausted — show denied state so user can retry manually
          setPermission('denied');
        }
      }
    };

    attemptStart();

    return () => {
      cancelled = true;
      startingRef.current = false;
      stopAndClear();
    };
  }, [permission, scanned, currentCustomer, addConsumptions, claimReward, navigate, stopAndClear]);

  const deviceInfo = getDeviceInstructions();

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col">
      <header className="p-6 flex items-center flex-shrink-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 -ml-2 text-white/70 hover:text-white"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-serif font-semibold ml-4">Scan QR Code</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">

          {/* ── Success ── */}
          {scanned && scanResult && (
            scanResult.type === 'redeem' && scanResult.claimedType ? (
              <motion.div
                key="success-redeem"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-24 h-24 bg-[var(--color-cozy-olive)] rounded-full flex items-center justify-center mb-6">
                  <Gift size={48} />
                </div>
                <h2 className="text-3xl font-serif font-semibold mb-2">Ingewisseld!</h2>
                <p className="text-white/70">
                  Gratis {cardTypeLabels[scanResult.claimedType].toLowerCase()} is ingewisseld
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="success-add"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center text-center"
              >
                {scanResult.bonusApplied ? (
                  <>
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                      className="w-24 h-24 bg-linear-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30"
                    >
                      <Sparkles size={48} className="text-white" />
                    </motion.div>
                    <h2 className="text-3xl font-serif font-semibold mb-3">Welkom bij Cozy Moments!</h2>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-linear-to-br from-amber-500/20 to-orange-500/10 rounded-2xl p-5 border border-amber-400/30 max-w-xs"
                    >
                      <p className="text-white/90 leading-relaxed">
                        Omdat dit je eerste scan is, krijg je van ons <span className="font-bold text-amber-300">2 extra stempels</span> cadeau op je kaart! 🎁
                      </p>
                    </motion.div>
                    {scanResult.bonusType !== undefined && currentCustomer && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mt-5 w-full max-w-xs"
                      >
                        <LoyaltyCard
                          type={scanResult.bonusType}
                          count={currentCustomer.cards[scanResult.bonusType]}
                          bonusStampPositions={[0, 1]}
                        />
                        <p className="text-center text-amber-300 text-xs mt-2 font-medium">
                          🎁 De gouden stempels zijn jouw cadeau!
                        </p>
                      </motion.div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 bg-[var(--color-cozy-olive)] rounded-full flex items-center justify-center mb-6">
                      <CheckCircle size={48} />
                    </div>
                    <h2 className="text-3xl font-serif font-semibold mb-2">Succesvol!</h2>
                    <p className="text-white/70">Consumpties zijn toegevoegd aan je kaart.</p>
                  </>
                )}

                {scanResult.earned && Object.values(scanResult.earned).some(v => v > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-6 bg-white/10 rounded-2xl p-4 border border-white/20"
                  >
                    <p className="text-white font-semibold mb-2 flex items-center gap-2 justify-center">
                      <Gift size={18} className="text-[var(--color-cozy-olive)]" />
                      Beloning verdiend!
                    </p>
                    {(Object.keys(scanResult.earned) as CardType[]).map(type => {
                      if (!scanResult.earned || scanResult.earned[type] <= 0) return null;
                      return (
                        <p key={type} className="text-white/80 text-sm">
                          {scanResult.earned[type]}x gratis {cardTypeLabels[type].toLowerCase()}
                        </p>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            )
          )}

          {/* ── Ask permission ── */}
          {!scanned && permission === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center max-w-xs"
            >
              <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center mb-8 ring-4 ring-white/20">
                <Camera size={52} className="text-white" />
              </div>
              <h2 className="text-2xl font-serif font-semibold mb-3">Camera toestemming</h2>
              <p className="text-white/60 mb-10 leading-relaxed">
                Om de QR code te scannen heeft de app toegang tot je camera nodig.
                Tik hieronder en geef toestemming wanneer je browser erom vraagt.
              </p>
              <button
                onClick={startCamera}
                className="w-full bg-white text-[#1a1a1a] font-semibold text-base rounded-2xl py-4 px-6 flex items-center justify-center gap-3 hover:bg-white/90 active:scale-95 transition-all shadow-lg"
              >
                <Camera size={20} />
                Camera toestaan &amp; scannen
              </button>
            </motion.div>
          )}

          {/* ── Requesting (native dialog shown) ── */}
          {!scanned && permission === 'requesting' && (
            <motion.div
              key="requesting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-6 animate-pulse">
                <Camera size={40} className="text-white" />
              </div>
              <p className="text-white/70 text-lg">Wachten op toestemming...</p>
              <p className="text-white/40 text-sm mt-2">Tik op "Toestaan" in het dialoogvenster</p>
            </motion.div>
          )}

          {/* ── Scanner active ── */}
          {!scanned && permission === 'granted' && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-sm flex flex-col items-center"
            >
              <div
                id="reader"
                className="w-full rounded-3xl overflow-hidden border-2 border-white/10"
              />
              <AnimatePresence>
                {scanError && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-center mt-4 font-medium"
                  >
                    {scanError}
                  </motion.p>
                )}
              </AnimatePresence>
              <p className="text-center text-white/40 mt-6 font-serif italic text-sm">
                Richt de camera op de QR code van de zaak
              </p>
            </motion.div>
          )}

          {/* ── Denied ── */}
          {!scanned && (permission === 'denied' || permission === 'unavailable') && (
            <motion.div
              key="denied"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center max-w-sm w-full"
            >
              <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                <Camera size={44} className="text-red-400" />
              </div>

              {permission === 'unavailable' ? (
                <>
                  {!window.isSecureContext ? (
                    <>
                      <h2 className="text-2xl font-serif font-semibold mb-2">HTTPS vereist</h2>
                      <p className="text-white/60 mb-4">
                        Camera toegang werkt alleen via een beveiligde verbinding.
                      </p>
                      <div className="w-full bg-white/5 rounded-2xl p-5 text-left mb-6 border border-white/10">
                        <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Oplossing</p>
                        <p className="text-sm text-white/80 leading-relaxed">
                          Open de app via <span className="font-semibold text-white">https://</span> in plaats van http://.
                          Typ het adres handmatig in de browser en vervang <span className="font-semibold text-white">http</span> door <span className="font-semibold text-white">https</span>.
                        </p>
                        <p className="text-xs text-white/40 mt-3">Je browser geeft mogelijk een certificaatwaarschuwing — kies dan "Toch doorgaan" of "Geavanceerd → Doorgaan".</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-serif font-semibold mb-2">Geen camera gevonden</h2>
                      <p className="text-white/60 mb-8">Dit apparaat heeft geen beschikbare camera.</p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-serif font-semibold mb-2">Camera geblokkeerd</h2>
                  <p className="text-white/60 mb-6">
                    Je hebt camera toegang geweigerd. Volg de stappen hieronder om het in te schakelen.
                  </p>

                  {/* Step-by-step instructions */}
                  <div className="w-full bg-white/5 rounded-2xl p-5 text-left mb-6 border border-white/10">
                    <p className="text-xs text-white/40 uppercase tracking-widest mb-4">{deviceInfo.browser}</p>
                    <ol className="space-y-3">
                      {deviceInfo.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                            {i + 1}
                          </span>
                          <span className="text-sm text-white/80 leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <button
                    onClick={() => { window.location.reload(); }}
                    className="w-full bg-white text-[#1a1a1a] font-semibold rounded-2xl py-4 px-6 flex items-center justify-center gap-3 hover:bg-white/90 active:scale-95 transition-all shadow-lg"
                  >
                    <RefreshCw size={18} />
                    Pagina herladen &amp; opnieuw proberen
                  </button>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
};
