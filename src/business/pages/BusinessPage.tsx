import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Coffee, Wine, Beer, Plus, Minus, QrCode, LogOut, ChevronDown, CheckCircle, Download, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessAuth } from '../store/BusinessAuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { useLoyalty, CardType, cardTypeLabels } from '../../shared/store/LoyaltyContext';
import { Screensaver } from '../components/Screensaver';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// ── Admin audio chime (same Web Audio approach as Scanner) ────────────────────
let adminAudioCtx: AudioContext | null = null;

function unlockAdminAudio() {
  try {
    if (!adminAudioCtx || adminAudioCtx.state === 'closed') {
      adminAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (adminAudioCtx.state === 'suspended') adminAudioCtx.resume();
  } catch { /* ignore */ }
}

async function playAdminChime() {
  try {
    if (!adminAudioCtx || adminAudioCtx.state === 'closed') {
      adminAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (adminAudioCtx.state === 'suspended') await adminAudioCtx.resume();
    const ctx = adminAudioCtx;
    const notes = [
      { freq: 660,  start: 0,    duration: 0.18 },
      { freq: 880,  start: 0.15, duration: 0.18 },
      { freq: 1100, start: 0.30, duration: 0.30 },
    ];
    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    });
  } catch { /* ignore */ }
}

export const BusinessPage: React.FC = () => {
  const { customers, refreshCustomers } = useLoyalty();
  const { logout } = useBusinessAuth();
  const [consumptions, setConsumptions] = useState<Record<CardType, number>>({
    coffee: 0,
    wine: 0,
    beer: 0,
  });
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrScanned, setQrScanned] = useState(false);
  const [view, setView] = useState<'create' | 'customers' | 'redeem'>('create');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  // Snapshot of customers when a QR is generated — used to detect when it gets scanned
  const customersSnapshotRef = useRef<string>('');

  // Unlock AudioContext on first tap (needed on iOS/Android)
  useEffect(() => {
    const handler = () => unlockAdminAudio();
    window.addEventListener('touchstart', handler, { once: true, passive: true });
    window.addEventListener('click', handler, { once: true, passive: true });
    return () => {
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('click', handler);
    };
  }, []);

  // Always fetch fresh data when the customers tab is opened
  useEffect(() => {
    if (view === 'customers') refreshCustomers();
  }, [view]);

  const handleIncrement = (type: CardType) => {
    setConsumptions(prev => ({ ...prev, [type]: prev[type] + 1 }));
  };

  const handleDecrement = (type: CardType) => {
    setConsumptions(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
  };

  const generateQR = () => {
    if (consumptions.coffee === 0 && consumptions.wine === 0 && consumptions.beer === 0) return;
    customersSnapshotRef.current = JSON.stringify(customers);
    const payload = {
      ...consumptions,
      txId: Math.random().toString(36).substring(7),
      timestamp: Date.now()
    };
    setQrPayload(JSON.stringify(payload));
  };

  const reset = () => {
    setConsumptions({ coffee: 0, wine: 0, beer: 0 });
    setQrPayload(null);
    setQrScanned(false);
    customersSnapshotRef.current = '';
  };

  // ── QR scan detection ──────────────────────────────────────────────────────
  // Strategy 1: React to customers state change (Supabase Realtime fires → fetchFromSupabase → new customers)
  // Strategy 2: Poll every 3 seconds while QR is shown (fallback if Realtime not enabled in Supabase dashboard)
  const checkScanned = useCallback(() => {
    if (!qrPayload || qrScanned || !customersSnapshotRef.current) return;
    const current = JSON.stringify(customers);
    if (current !== customersSnapshotRef.current) {
      setQrScanned(true);
      playAdminChime();
    }
  }, [qrPayload, qrScanned, customers]);

  // Fires whenever customers state changes (Realtime path)
  useEffect(() => { checkScanned(); }, [customers]);

  // Poll every 3s as fallback
  useEffect(() => {
    if (!qrPayload || qrScanned) return;
    const interval = setInterval(async () => {
      await refreshCustomers();
      // checkScanned will run via the [customers] effect after state updates
    }, 3000);
    return () => clearInterval(interval);
  }, [qrPayload, qrScanned]);

  // Once scanned — auto-close after 2 seconds
  useEffect(() => {
    if (!qrScanned) return;
    const t = setTimeout(() => {
      setConsumptions({ coffee: 0, wine: 0, beer: 0 });
      setQrPayload(null);
      setQrScanned(false);
      customersSnapshotRef.current = '';
    }, 2000);
    return () => clearTimeout(t);
  }, [qrScanned]);

  // Auto-reset QR after 60 seconds (hard safety net)
  useEffect(() => {
    if (!qrPayload) return;
    const t = setTimeout(() => reset(), 60_000);
    return () => clearTimeout(t);
  }, [qrPayload]);

  const totalConsumptions = consumptions.coffee + consumptions.wine + consumptions.beer;

  return (
    <div className="min-h-screen bg-[#f5f5f0] pb-24">
      {/* Screensaver — activates after 60s idle, disappears on touch */}
      <Screensaver onWake={() => { /* admin is back */ }} />

      <header className="bg-white px-6 py-2 rounded-b-[28px] shadow-sm mb-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="w-10" />
          <div className="flex items-center">
            <img src="/cozylogo.png" alt="COZY Moments" className="w-20 h-20 object-contain" />
          </div>
          <button
            onClick={logout}
            title="Uitloggen"
            className="w-10 h-10 bg-gray-100 hover:bg-red-50 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"
          >
            <LogOut size={18} />
          </button>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-full mb-1">
          <button
            onClick={() => { reset(); setView('create'); }}
            className={cn(
              "flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all",
              view === 'create' ? "bg-white shadow text-[var(--color-cozy-olive)]" : "text-gray-500"
            )}
          >
            Nieuwe QR
          </button>
          <button
            onClick={() => { reset(); setView('customers'); }}
            className={cn(
              "flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all",
              view === 'customers' ? "bg-white shadow text-[var(--color-cozy-olive)]" : "text-gray-500"
            )}
          >
            Klanten
          </button>
          <button
            onClick={() => { reset(); setView('redeem'); }}
            className={cn(
              "flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all",
              view === 'redeem' ? "bg-white shadow text-[var(--color-cozy-olive)]" : "text-gray-500"
            )}
          >
            Inwisselen
          </button>
        </div>
      </header>

      <main className="px-6">
        {view === 'create' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {!qrPayload ? (
              <div className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-[var(--color-cozy-text)] mb-8">
                  Selecteer Consumpties
                </h2>
                
                <ConsumptionRow 
                  type="coffee" 
                  title="Koffie" 
                  icon={Coffee} 
                  count={consumptions.coffee} 
                  onInc={() => handleIncrement('coffee')} 
                  onDec={() => handleDecrement('coffee')}
                  color="text-[var(--color-cozy-coffee)]"
                  bg="bg-[#e8dcc8]"
                />
                
                <ConsumptionRow 
                  type="wine" 
                  title="Wijn" 
                  icon={Wine} 
                  count={consumptions.wine} 
                  onInc={() => handleIncrement('wine')} 
                  onDec={() => handleDecrement('wine')}
                  color="text-[var(--color-cozy-wine)]"
                  bg="bg-[#f0d8dc]"
                />
                
                <ConsumptionRow 
                  type="beer" 
                  title="Bier" 
                  icon={Beer} 
                  count={consumptions.beer} 
                  onInc={() => handleIncrement('beer')} 
                  onDec={() => handleDecrement('beer')}
                  color="text-[var(--color-cozy-beer)]"
                  bg="bg-[#fcf4d9]"
                />

                <motion.button
                  onClick={generateQR}
                  disabled={totalConsumptions === 0}
                  animate={totalConsumptions > 0 ? { scale: [1, 1.025, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className={cn(
                    "w-full mt-8 rounded-full py-4 px-6 flex items-center justify-center gap-3 transition-all duration-300",
                    totalConsumptions > 0 
                      ? "bg-gradient-to-r from-[#f0ebe0] to-[#e4dccf] border border-[var(--color-cozy-olive)]/25 text-[var(--color-cozy-text)] shadow-md active:scale-[0.98]" 
                      : "bg-gray-100 text-gray-400 cursor-not-allowed border border-transparent"
                  )}
                >
                  <QrCode size={24} />
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={totalConsumptions > 0 ? 'active' : 'inactive'}
                      initial={{ opacity: 0.5, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="font-serif font-semibold text-lg tracking-wide"
                    >
                      Genereer QR Code
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              </div>
            ) : qrScanned ? (
              <motion.div
                key="scanned-create"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="w-24 h-24 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle size={48} className="text-green-500" />
                </div>
                <h3 className="text-2xl font-serif font-semibold text-[var(--color-cozy-text)] mb-2">QR gescand!</h3>
                <p className="text-gray-500">Transactie verwerkt — scherm sluit automatisch</p>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="bg-white p-8 rounded-[40px] shadow-xl mb-8">
                  <QRCodeSVG value={qrPayload} size={240} level="H" />
                </div>
                <h3 className="text-2xl font-serif font-semibold text-[var(--color-cozy-text)] mb-2">
                  Laat de klant scannen
                </h3>
                <p className="text-gray-500 text-center mb-8">
                  {consumptions.coffee > 0 && `${consumptions.coffee} Koffie `}
                  {consumptions.wine > 0 && `${consumptions.wine} Wijn `}
                  {consumptions.beer > 0 && `${consumptions.beer} Bier `}
                </p>
                <button
                  onClick={reset}
                  className="bg-white text-[var(--color-cozy-text)] border border-gray-200 rounded-full py-3 px-8 shadow-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Nieuwe Transactie
                </button>
              </div>
            )}
          </motion.div>
        )}

        {view === 'customers' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-serif font-semibold text-[var(--color-cozy-text)]">
                Klanten Overzicht
              </h2>
              <button
                onClick={() => {
                  const now = new Date();
                  const dateStr = now.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  const timeStr = now.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
                  const lines: string[] = [
                    '════════════════════════════════════════════════════',
                    '         COZY MOMENTS — KLANTENEXPORT',
                    `         ${dateStr} om ${timeStr}`,
                    '════════════════════════════════════════════════════',
                    '',
                    `Totaal aantal klanten: ${customers.length}`,
                    '',
                  ];
                  customers.forEach((c, i) => {
                    lines.push('────────────────────────────────────────');
                    lines.push(`${i + 1}. ${c.name}`);
                    lines.push(`   E-mail:      ${c.email || '—'}`);
                    lines.push(`   Stempels:    Koffie: ${c.cards.coffee}/10  |  Wijn: ${c.cards.wine}/10  |  Bier: ${c.cards.beer}/10`);
                    lines.push(`   Beloningen:  Koffie: ${c.rewards.coffee || 0}  |  Wijn: ${c.rewards.wine || 0}  |  Bier: ${c.rewards.beer || 0}`);
                    lines.push(`   Ingewisseld: Koffie: ${c.claimedRewards?.coffee || 0}  |  Wijn: ${c.claimedRewards?.wine || 0}  |  Bier: ${c.claimedRewards?.beer || 0}`);
                    lines.push('');
                  });
                  lines.push('────────────────────────────────────────');
                  lines.push('');
                  lines.push('Geëxporteerd door Cozy Moments Loyalty');

                  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `cozy-moments-klanten-${now.toISOString().slice(0,10)}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-full py-2 px-4 text-sm font-medium text-[var(--color-cozy-text)] shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
              >
                <Download size={16} />
                Export
              </button>
            </div>
            
            {customers.map(customer => {
              const isExpanded = expandedCustomer === customer.id;
              return (
                <div key={customer.id} className="bg-white rounded-[24px] shadow-sm overflow-hidden">
                  {/* Header row — always visible, tap to expand */}
                  <button
                    onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)}
                    className="w-full flex items-center gap-5 p-5 text-left active:bg-gray-50 transition-colors"
                  >
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-serif font-bold text-2xl flex-shrink-0">
                      {customer.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif font-semibold text-lg leading-tight">{customer.name}</h3>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{customer.email}</p>
                    </div>
                    {/* Large stamp counters — fill the whitespace */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex flex-col items-center bg-[#e8dcc8]/30 rounded-2xl px-4 py-2 min-w-[72px]">
                        <Coffee size={18} className="text-[var(--color-cozy-coffee)] mb-0.5" />
                        <span className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{customer.cards.coffee}<span className="text-xs font-normal text-gray-400">/10</span></span>
                      </div>
                      <div className="flex flex-col items-center bg-[#f0d8dc]/30 rounded-2xl px-4 py-2 min-w-[72px]">
                        <Wine size={18} className="text-[var(--color-cozy-wine)] mb-0.5" />
                        <span className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{customer.cards.wine}<span className="text-xs font-normal text-gray-400">/10</span></span>
                      </div>
                      <div className="flex flex-col items-center bg-[#fcf4d9]/30 rounded-2xl px-4 py-2 min-w-[72px]">
                        <Beer size={18} className="text-[var(--color-cozy-beer)] mb-0.5" />
                        <span className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{customer.cards.beer}<span className="text-xs font-normal text-gray-400">/10</span></span>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex-shrink-0 text-gray-400 ml-1"
                    >
                      <ChevronDown size={18} />
                    </motion.div>
                  </button>

                  {/* Collapsible detail */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="detail"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 border-t border-gray-50">
                          {/* Email */}
                          <div className="flex items-center gap-2 mt-4 mb-4 bg-gray-50 rounded-xl px-4 py-3">
                            <Mail size={16} className="text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-600 break-all">{customer.email || 'Geen e-mail beschikbaar'}</span>
                          </div>

                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Stempelkaart</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-[#e8dcc8]/30 rounded-xl p-3 flex flex-col items-center">
                              <Coffee size={20} className="text-[var(--color-cozy-coffee)] mb-1" />
                              <span className="font-mono text-sm font-medium">{customer.cards.coffee}/10</span>
                            </div>
                            <div className="bg-[#f0d8dc]/30 rounded-xl p-3 flex flex-col items-center">
                              <Wine size={20} className="text-[var(--color-cozy-wine)] mb-1" />
                              <span className="font-mono text-sm font-medium">{customer.cards.wine}/10</span>
                            </div>
                            <div className="bg-[#fcf4d9]/30 rounded-xl p-3 flex flex-col items-center">
                              <Beer size={20} className="text-[var(--color-cozy-beer)] mb-1" />
                              <span className="font-mono text-sm font-medium">{customer.cards.beer}/10</span>
                            </div>
                          </div>

                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-4">Ingewisseld</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-[#e8dcc8]/10 rounded-xl p-3 flex flex-col items-center border border-[#e8dcc8]/30">
                              <Coffee size={16} className="text-[var(--color-cozy-coffee)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.claimedRewards?.coffee || 0}</span>
                              <span className="text-[10px] text-gray-400">gratis</span>
                            </div>
                            <div className="bg-[#f0d8dc]/10 rounded-xl p-3 flex flex-col items-center border border-[#f0d8dc]/30">
                              <Wine size={16} className="text-[var(--color-cozy-wine)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.claimedRewards?.wine || 0}</span>
                              <span className="text-[10px] text-gray-400">gratis</span>
                            </div>
                            <div className="bg-[#fcf4d9]/10 rounded-xl p-3 flex flex-col items-center border border-[#fcf4d9]/30">
                              <Beer size={16} className="text-[var(--color-cozy-beer)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.claimedRewards?.beer || 0}</span>
                              <span className="text-[10px] text-gray-400">gratis</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}

        {view === 'redeem' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {!qrPayload ? (
              <div className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-[var(--color-cozy-text)] mb-4">
                  Inwisselen
                </h2>
                <p className="text-gray-500 -mt-2 mb-4">
                  Selecteer het drankje dat de klant gratis krijgt:
                </p>

                <div className="space-y-3">
                  {(['coffee', 'wine', 'beer'] as CardType[]).map(type => {
                    const icons: Record<CardType, React.ElementType> = { coffee: Coffee, wine: Wine, beer: Beer };
                    const colors: Record<CardType, string> = { coffee: 'bg-[#e8dcc8]', wine: 'bg-[#f0d8dc]', beer: 'bg-[#fcf4d9]' };
                    const textColors: Record<CardType, string> = { coffee: 'text-[var(--color-cozy-coffee)]', wine: 'text-[var(--color-cozy-wine)]', beer: 'text-[var(--color-cozy-beer)]' };
                    const Icon = icons[type];

                    return (
                      <button
                        key={type}
                        onClick={() => {
                          customersSnapshotRef.current = JSON.stringify(customers);
                          const payload = {
                            type: 'redeem',
                            cardType: type,
                            txId: Math.random().toString(36).substring(7),
                            timestamp: Date.now(),
                          };
                          setQrPayload(JSON.stringify(payload));
                        }}
                        className="w-full bg-white rounded-[24px] p-5 shadow-sm flex items-center gap-4 hover:bg-gray-50 active:scale-[0.98] transition-all"
                      >
                        <div className={cn("w-14 h-14 rounded-full flex items-center justify-center", colors[type])}>
                          <Icon size={28} className={textColors[type]} />
                        </div>
                        <span className="font-serif font-semibold text-xl text-[var(--color-cozy-text)]">
                          Gratis {cardTypeLabels[type]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : qrScanned ? (
              <motion.div
                key="scanned-redeem"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="w-24 h-24 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle size={48} className="text-green-500" />
                </div>
                <h3 className="text-2xl font-serif font-semibold text-[var(--color-cozy-text)] mb-2">QR gescand!</h3>
                <p className="text-gray-500">Beloning ingewisseld — scherm sluit automatisch</p>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="bg-white p-8 rounded-[40px] shadow-xl mb-8">
                  <QRCodeSVG value={qrPayload} size={240} level="H" />
                </div>
                <h3 className="text-2xl font-serif font-semibold text-[var(--color-cozy-text)] mb-2">
                  Laat de klant scannen
                </h3>
                <p className="text-gray-500 text-center mb-8">
                  De klant scant deze code om de gratis consumptie in te wisselen
                </p>
                <button
                  onClick={reset}
                  className="bg-white text-[var(--color-cozy-text)] border border-gray-200 rounded-full py-3 px-8 shadow-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Nieuwe Transactie
                </button>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
};

interface ConsumptionRowProps {
  type: CardType;
  title: string;
  icon: React.ElementType;
  count: number;
  onInc: () => void;
  onDec: () => void;
  color: string;
  bg: string;
}

const ConsumptionRow: React.FC<ConsumptionRowProps> = ({ title, icon: Icon, count, onInc, onDec, color, bg }) => {
  return (
    <div className="bg-white rounded-[24px] p-4 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", bg, color)}>
          <Icon size={24} />
        </div>
        <span className="font-serif font-semibold text-xl">{title}</span>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={onDec}
          disabled={count === 0}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-50"
        >
          <Minus size={20} />
        </button>
        <span className="font-mono text-xl font-medium w-6 text-center">{count}</span>
        <button 
          onClick={onInc}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};
