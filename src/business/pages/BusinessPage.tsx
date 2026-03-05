import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Coffee, Wine, Beer, GlassWater, Plus, Minus, QrCode, LogOut, ChevronDown, CheckCircle, Download, Mail } from 'lucide-react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { useBusinessAuth } from '../store/BusinessAuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { useLoyalty, CardType, cardTypeLabels } from '../../shared/store/LoyaltyContext';
import { Screensaver } from '../components/Screensaver';
import { signQrPayload } from '../../shared/lib/qr-crypto';
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

// ── Consumption stats helper ─────────────────────────────────────────────────
const MS_PER_MONTH = 30.4375 * 24 * 60 * 60 * 1000;

function calcCustomerStats(customer: import('../../shared/store/LoyaltyContext').Customer, nowMs: number) {
  const createdMs = new Date(customer.createdAt).getTime();
  const monthsActive = Math.max(1, (nowMs - createdMs) / MS_PER_MONTH);
  const total: Record<CardType, number> = {
    coffee: (customer.claimedRewards.coffee + customer.rewards.coffee) * 10 + customer.cards.coffee,
    wine:   (customer.claimedRewards.wine   + customer.rewards.wine  ) * 10 + customer.cards.wine,
    beer:   (customer.claimedRewards.beer   + customer.rewards.beer  ) * 10 + customer.cards.beer,
    soda:   (customer.claimedRewards.soda   + customer.rewards.soda  ) * 10 + customer.cards.soda,
  };
  const avgPerMonth: Record<CardType, number> = {
    coffee: total.coffee / monthsActive,
    wine:   total.wine   / monthsActive,
    beer:   total.beer   / monthsActive,
    soda:   total.soda   / monthsActive,
  };
  return { total, avgPerMonth, monthsActive };
}

export const BusinessPage: React.FC = () => {
  const { customers, refreshCustomers } = useLoyalty();
  const { logout } = useBusinessAuth();
  const [consumptions, setConsumptions] = useState<Record<CardType, number>>({
    coffee: 0,
    wine: 0,
    beer: 0,
    soda: 0,
  });
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrScanned, setQrScanned] = useState(false);
  const [view, setView] = useState<'create' | 'customers' | 'redeem'>('create');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  const generateQR = async () => {
    if (consumptions.coffee === 0 && consumptions.wine === 0 && consumptions.beer === 0 && consumptions.soda === 0) return;
    customersSnapshotRef.current = JSON.stringify(customers);
    const payload = {
      ...consumptions,
      txId: Math.random().toString(36).substring(7),
      timestamp: Date.now()
    };
    setQrPayload(await signQrPayload(payload));
  };

  const reset = () => {
    setConsumptions({ coffee: 0, wine: 0, beer: 0, soda: 0 });
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
      setConsumptions({ coffee: 0, wine: 0, beer: 0, soda: 0 });
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

  const totalConsumptions = consumptions.coffee + consumptions.wine + consumptions.beer + consumptions.soda;

  return (
    <div className="min-h-screen bg-[#f5f5f0] pb-24">
      {/* Screensaver — activates after 60s idle, disappears on touch */}
      <Screensaver onWake={() => { /* admin is back */ }} />

      {/* WebaanZee credit — fixed bottom right, all tabs */}
      <a
        href="https://www.webaanzee.be"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-5 flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity z-50"
        style={{ fontSize: '10px', letterSpacing: '0.04em', textDecoration: 'none' }}
      >
        <span style={{ color: '#111', fontWeight: 500 }}>realisatie door </span>
        <span style={{ fontWeight: 700 }}>
          <span style={{ color: '#111' }}>Web</span><span style={{ color: '#f59e0b' }}>aan</span><span style={{ color: '#111' }}>Zee</span>
        </span>
      </a>

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
              "flex-1 py-2 px-4 rounded-full text-sm font-display font-bold transition-all",
              view === 'create' ? "bg-white shadow text-[var(--color-cozy-olive)]" : "text-gray-500"
            )}
          >
            Nieuwe QR
          </button>
          <button
            onClick={() => { reset(); setView('customers'); }}
            className={cn(
              "flex-1 py-2 px-4 rounded-full text-sm font-display font-bold transition-all",
              view === 'customers' ? "bg-white shadow text-[var(--color-cozy-olive)]" : "text-gray-500"
            )}
          >
            Klanten
          </button>
          <button
            onClick={() => { reset(); setView('redeem'); }}
            className={cn(
              "flex-1 py-2 px-4 rounded-full text-sm font-display font-bold transition-all",
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
                <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)] mb-8">
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
                  index={0}
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
                  index={1}
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
                  index={2}
                />

                <ConsumptionRow 
                  type="soda" 
                  title="Frisdrank" 
                  icon={GlassWater} 
                  count={consumptions.soda} 
                  onInc={() => handleIncrement('soda')} 
                  onDec={() => handleDecrement('soda')}
                  color="text-[var(--color-cozy-soda)]"
                  bg="bg-[#fce4f0]"
                  index={3}
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
                  {consumptions.soda > 0 && `${consumptions.soda} Frisdrank `}
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
              <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)]">
                Klanten Overzicht
              </h2>
              <button
                onClick={() => {
                  const now = new Date();
                  const dateStr = now.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  const timeStr = now.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
                  const fileDate = now.toISOString().slice(0, 10);

                  // ── Helper: trigger a download ─────────────────────
                  const download = (content: string, filename: string, mime: string) => {
                    const BOM = '\uFEFF'; // UTF-8 BOM so Excel reads accents correctly
                    const blob = new Blob([BOM + content], { type: `${mime};charset=utf-8` });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  };

                  // ── Pre-compute stats for all customers ────────────
                  const nowMs = now.getTime();
                  const allStats = customers.map(c => calcCustomerStats(c, nowMs));
                  const grandTotal = {
                    coffee: allStats.reduce((s, st) => s + st.total.coffee, 0),
                    wine:   allStats.reduce((s, st) => s + st.total.wine,   0),
                    beer:   allStats.reduce((s, st) => s + st.total.beer,   0),
                    soda:   allStats.reduce((s, st) => s + st.total.soda,   0),
                  };

                  // ── 1. CSV (Excel / nieuwsbrief import) ────────────
                  // Belgian/Dutch Excel uses semicolons as separator
                  const SEP = ';';
                  const csvHeader = ['Naam','Email','Koffie_Stempels','Wijn_Stempels','Bier_Stempels','Frisdrank_Stempels','Koffie_Volle_Kaarten','Wijn_Volle_Kaarten','Bier_Volle_Kaarten','Frisdrank_Volle_Kaarten','Koffie_Ingewisseld','Wijn_Ingewisseld','Bier_Ingewisseld','Frisdrank_Ingewisseld','Koffie_Totaal','Wijn_Totaal','Bier_Totaal','Frisdrank_Totaal','Koffie_Gem_Maand','Wijn_Gem_Maand','Bier_Gem_Maand','Frisdrank_Gem_Maand','Klant_Sinds'].join(SEP);
                  const csvRows = customers.map((c, idx) => {
                    const st = allStats[idx];
                    const name = `"${c.name.replace(/"/g, '""')}"`;
                    const email = `"${(c.email || '').replace(/"/g, '""')}"`;
                    const since = new Date(c.createdAt).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    return [name, email, c.cards.coffee, c.cards.wine, c.cards.beer, c.cards.soda, c.rewards.coffee || 0, c.rewards.wine || 0, c.rewards.beer || 0, c.rewards.soda || 0, c.claimedRewards?.coffee || 0, c.claimedRewards?.wine || 0, c.claimedRewards?.beer || 0, c.claimedRewards?.soda || 0, st.total.coffee, st.total.wine, st.total.beer, st.total.soda, st.avgPerMonth.coffee.toFixed(1), st.avgPerMonth.wine.toFixed(1), st.avgPerMonth.beer.toFixed(1), st.avgPerMonth.soda.toFixed(1), since].join(SEP);
                  });
                  const csvTotalsRow = ['"TOTAAL ALLE KLANTEN"', '', '', '', '', '', '', '', '', '', '', '', '', '', grandTotal.coffee, grandTotal.wine, grandTotal.beer, grandTotal.soda, '', '', '', '', ''].join(SEP);
                  download([csvHeader, ...csvRows, '', csvTotalsRow].join('\n'), `cozy-moments-klanten-${fileDate}.csv`, 'text/csv');

                  // ── 2. TXT (leesbaar overzicht) ────────────────────
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
                    const st = allStats[i];
                    const since = new Date(c.createdAt).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    lines.push('────────────────────────────────────────');
                    lines.push(`${i + 1}. ${c.name}`);
                    lines.push(`   E-mail:        ${c.email || '—'}`);
                    lines.push(`   Klant sinds:   ${since}`);
                    lines.push(`   Totaal:        Koffie: ${st.total.coffee}  |  Wijn: ${st.total.wine}  |  Bier: ${st.total.beer}  |  Frisdrank: ${st.total.soda}`);
                    lines.push(`   Gem/maand:     Koffie: ${st.avgPerMonth.coffee.toFixed(1)}  |  Wijn: ${st.avgPerMonth.wine.toFixed(1)}  |  Bier: ${st.avgPerMonth.beer.toFixed(1)}  |  Frisdrank: ${st.avgPerMonth.soda.toFixed(1)}`);
                    lines.push(`   Stempels:      Koffie: ${c.cards.coffee}/10  |  Wijn: ${c.cards.wine}/10  |  Bier: ${c.cards.beer}/10  |  Frisdrank: ${c.cards.soda}/10`);
                    lines.push(`   Volle kaarten: Koffie: ${c.rewards.coffee || 0}  |  Wijn: ${c.rewards.wine || 0}  |  Bier: ${c.rewards.beer || 0}  |  Frisdrank: ${c.rewards.soda || 0}`);
                    lines.push(`   Ingewisseld:   Koffie: ${c.claimedRewards?.coffee || 0}  |  Wijn: ${c.claimedRewards?.wine || 0}  |  Bier: ${c.claimedRewards?.beer || 0}  |  Frisdrank: ${c.claimedRewards?.soda || 0}`);
                    lines.push('');
                  });
                  lines.push('════════════════════════════════════════════════════');
                  lines.push('  TOTAAL VERKOCHT — ALLE KLANTEN SAMEN');
                  lines.push('════════════════════════════════════════════════════');
                  lines.push(`  Koffie:    ${grandTotal.coffee} consumpties`);
                  lines.push(`  Wijn:      ${grandTotal.wine} consumpties`);
                  lines.push(`  Bier:      ${grandTotal.beer} consumpties`);
                  lines.push(`  Frisdrank: ${grandTotal.soda} consumpties`);
                  lines.push('');
                  lines.push('Geëxporteerd door Cozy Moments Loyalty');

                  // Small delay so the browser doesn't block the second download
                  setTimeout(() => {
                    download(lines.join('\n'), `cozy-moments-klanten-${fileDate}.txt`, 'text/plain');
                  }, 300);
                }}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-full py-2 px-4 text-sm font-medium text-[var(--color-cozy-text)] shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
              >
                <Download size={16} />
                Export
              </button>
            </div>
            
            {/* Search bar */}
            <div className="relative mb-2">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Zoek op naam of e-mailadres..."
                className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-10 py-3 text-sm text-[var(--color-cozy-text)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-cozy-olive)] shadow-sm transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-3 flex items-center px-1 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Customer list */}
            {(() => {
              const q = searchQuery.trim().toLowerCase();
              const filtered = q
                ? customers.filter(c =>
                    c.name.toLowerCase().includes(q) ||
                    (c.email || '').toLowerCase().includes(q)
                  )
                : customers;
              if (filtered.length === 0) return (
                <p className="text-center text-gray-400 text-sm py-10">
                  Geen klanten gevonden voor &ldquo;{searchQuery}&rdquo;
                </p>
              );
              return filtered.map(customer => {
              const isExpanded = expandedCustomer === customer.id;
              const stats = calcCustomerStats(customer, Date.now());
              return (
                <div key={customer.id} className="bg-white rounded-[24px] shadow-sm overflow-hidden">
                  {/* Header row — always visible, tap to expand */}
                  <button
                    onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)}
                    className="w-full p-4 md:p-5 text-left active:bg-gray-50 transition-colors"
                  >
                    {/* Top: avatar + name + chevron (always one row) */}
                    <div className="flex items-center gap-3 md:gap-5">
                      <div className="w-11 h-11 md:w-14 md:h-14 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-serif font-bold text-xl md:text-2xl flex-shrink-0">
                        {customer.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif font-semibold text-base md:text-lg leading-tight truncate">{customer.name}</h3>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{customer.email}</p>
                      </div>
                      {/* Desktop: stamp counters inline */}
                      <div className="hidden md:flex items-center gap-3 flex-shrink-0">
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
                        <div className="flex flex-col items-center bg-[#fce4f0]/30 rounded-2xl px-4 py-2 min-w-[72px]">
                          <GlassWater size={18} className="text-[var(--color-cozy-soda)] mb-0.5" />
                          <span className="font-mono text-lg font-bold text-[var(--color-cozy-text)]">{customer.cards.soda}<span className="text-xs font-normal text-gray-400">/10</span></span>
                        </div>
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex-shrink-0 text-gray-400 ml-1"
                      >
                        <ChevronDown size={18} />
                      </motion.div>
                    </div>
                    {/* Mobile: stamp counters below name */}
                    <div className="flex md:hidden items-center gap-2 mt-3 ml-14">
                      <div className="flex-1 flex flex-col items-center bg-[#e8dcc8]/30 rounded-xl py-1.5">
                        <Coffee size={14} className="text-[var(--color-cozy-coffee)] mb-0.5" />
                        <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{customer.cards.coffee}<span className="text-[10px] font-normal text-gray-400">/10</span></span>
                      </div>
                      <div className="flex-1 flex flex-col items-center bg-[#f0d8dc]/30 rounded-xl py-1.5">
                        <Wine size={14} className="text-[var(--color-cozy-wine)] mb-0.5" />
                        <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{customer.cards.wine}<span className="text-[10px] font-normal text-gray-400">/10</span></span>
                      </div>
                      <div className="flex-1 flex flex-col items-center bg-[#fcf4d9]/30 rounded-xl py-1.5">
                        <Beer size={14} className="text-[var(--color-cozy-beer)] mb-0.5" />
                        <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{customer.cards.beer}<span className="text-[10px] font-normal text-gray-400">/10</span></span>
                      </div>
                      <div className="flex-1 flex flex-col items-center bg-[#fce4f0]/30 rounded-xl py-1.5">
                        <GlassWater size={14} className="text-[var(--color-cozy-soda)] mb-0.5" />
                        <span className="font-mono text-sm font-bold text-[var(--color-cozy-text)]">{customer.cards.soda}<span className="text-[10px] font-normal text-gray-400">/10</span></span>
                      </div>
                    </div>
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

                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Totale consumptions</p>
                          <div className="grid grid-cols-4 gap-2 mb-1">
                            <div className="bg-[#e8dcc8]/40 rounded-xl p-3 flex flex-col items-center">
                              <Coffee size={16} className="text-[var(--color-cozy-coffee)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.total.coffee}</span>
                              <span className="text-[10px] text-gray-400">totaal</span>
                            </div>
                            <div className="bg-[#f0d8dc]/40 rounded-xl p-3 flex flex-col items-center">
                              <Wine size={16} className="text-[var(--color-cozy-wine)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.total.wine}</span>
                              <span className="text-[10px] text-gray-400">totaal</span>
                            </div>
                            <div className="bg-[#fcf4d9]/40 rounded-xl p-3 flex flex-col items-center">
                              <Beer size={16} className="text-[var(--color-cozy-beer)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.total.beer}</span>
                              <span className="text-[10px] text-gray-400">totaal</span>
                            </div>
                            <div className="bg-[#fce4f0]/40 rounded-xl p-3 flex flex-col items-center">
                              <GlassWater size={16} className="text-[var(--color-cozy-soda)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.total.soda}</span>
                              <span className="text-[10px] text-gray-400">totaal</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 mb-1">
                            <div className="bg-[#e8dcc8]/20 rounded-xl p-3 flex flex-col items-center">
                              <Coffee size={14} className="text-[var(--color-cozy-coffee)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.avgPerMonth.coffee.toFixed(1)}</span>
                              <span className="text-[10px] text-gray-400">/maand</span>
                            </div>
                            <div className="bg-[#f0d8dc]/20 rounded-xl p-3 flex flex-col items-center">
                              <Wine size={14} className="text-[var(--color-cozy-wine)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.avgPerMonth.wine.toFixed(1)}</span>
                              <span className="text-[10px] text-gray-400">/maand</span>
                            </div>
                            <div className="bg-[#fcf4d9]/20 rounded-xl p-3 flex flex-col items-center">
                              <Beer size={14} className="text-[var(--color-cozy-beer)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.avgPerMonth.beer.toFixed(1)}</span>
                              <span className="text-[10px] text-gray-400">/maand</span>
                            </div>
                            <div className="bg-[#fce4f0]/20 rounded-xl p-3 flex flex-col items-center">
                              <GlassWater size={14} className="text-[var(--color-cozy-soda)] mb-1" />
                              <span className="font-mono text-sm font-bold">{stats.avgPerMonth.soda.toFixed(1)}</span>
                              <span className="text-[10px] text-gray-400">/maand</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-300 text-right mb-4">
                            klant sinds {new Date(customer.createdAt).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })} ({stats.monthsActive < 2 ? '< 1 maand' : `${Math.floor(stats.monthsActive)} maanden`})
                          </p>

                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Stempelkaart</p>
                          <div className="grid grid-cols-4 gap-2">
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
                            <div className="bg-[#fce4f0]/30 rounded-xl p-3 flex flex-col items-center">
                              <GlassWater size={20} className="text-[var(--color-cozy-soda)] mb-1" />
                              <span className="font-mono text-sm font-medium">{customer.cards.soda}/10</span>
                            </div>
                          </div>

                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-4">Volle kaarten (ongeclaimd)</p>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-[#e8dcc8]/20 rounded-xl p-3 flex flex-col items-center border border-[#e8dcc8]/50">
                              <Coffee size={16} className="text-[var(--color-cozy-coffee)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.rewards.coffee || 0}</span>
                              <span className="text-[10px] text-gray-400">te claimen</span>
                            </div>
                            <div className="bg-[#f0d8dc]/20 rounded-xl p-3 flex flex-col items-center border border-[#f0d8dc]/50">
                              <Wine size={16} className="text-[var(--color-cozy-wine)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.rewards.wine || 0}</span>
                              <span className="text-[10px] text-gray-400">te claimen</span>
                            </div>
                            <div className="bg-[#fcf4d9]/20 rounded-xl p-3 flex flex-col items-center border border-[#fcf4d9]/50">
                              <Beer size={16} className="text-[var(--color-cozy-beer)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.rewards.beer || 0}</span>
                              <span className="text-[10px] text-gray-400">te claimen</span>
                            </div>
                            <div className="bg-[#fce4f0]/20 rounded-xl p-3 flex flex-col items-center border border-[#fce4f0]/50">
                              <GlassWater size={16} className="text-[var(--color-cozy-soda)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.rewards.soda || 0}</span>
                              <span className="text-[10px] text-gray-400">te claimen</span>
                            </div>
                          </div>

                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-4">Ingewisseld</p>
                          <div className="grid grid-cols-4 gap-2">
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
                            <div className="bg-[#fce4f0]/10 rounded-xl p-3 flex flex-col items-center border border-[#fce4f0]/30">
                              <GlassWater size={16} className="text-[var(--color-cozy-soda)] mb-1" />
                              <span className="font-mono text-sm font-bold">{customer.claimedRewards?.soda || 0}</span>
                              <span className="text-[10px] text-gray-400">gratis</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
              }); // end filtered.map
            })()} 
          </motion.div>
        )}

        {view === 'redeem' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {!qrPayload ? (
              <div className="space-y-6">
                <h2 className="text-3xl font-display font-bold text-[var(--color-cozy-text)] mb-4">
                  Inwisselen
                </h2>
                <p className="text-gray-500 -mt-2 mb-4">
                  Selecteer het drankje dat de klant gratis krijgt:
                </p>

                <div className="space-y-3">
                  {(['coffee', 'wine', 'beer', 'soda'] as CardType[]).map((type, index) => {
                    const icons: Record<CardType, React.ElementType> = { coffee: Coffee, wine: Wine, beer: Beer, soda: GlassWater };
                    const colors: Record<CardType, string> = { coffee: 'bg-[#e8dcc8]', wine: 'bg-[#f0d8dc]', beer: 'bg-[#fcf4d9]', soda: 'bg-[#fce4f0]' };
                    const textColors: Record<CardType, string> = { coffee: 'text-[var(--color-cozy-coffee)]', wine: 'text-[var(--color-cozy-wine)]', beer: 'text-[var(--color-cozy-beer)]', soda: 'text-[var(--color-cozy-soda)]' };
                    const Icon = icons[type];

                    return (
                      <button
                        key={type}
                        onClick={async () => {
                          customersSnapshotRef.current = JSON.stringify(customers);
                          const payload = {
                            type: 'redeem',
                            cardType: type,
                            txId: Math.random().toString(36).substring(7),
                            timestamp: Date.now(),
                          };
                          setQrPayload(await signQrPayload(payload));
                        }}
                        className="w-full bg-white rounded-[24px] p-5 shadow-sm flex items-center gap-4 hover:bg-gray-50 active:scale-[0.98] transition-all overflow-hidden"
                      >
                        <motion.div
                          className={cn("w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0", colors[type])}
                          initial={{ x: 80, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <Icon size={28} className={textColors[type]} />
                        </motion.div>
                        <motion.span
                          className="font-display font-bold text-xl text-[var(--color-cozy-text)]"
                          initial={{ x: 60, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ duration: 0.55, delay: index * 0.08 + 0.07, ease: [0.22, 1, 0.36, 1] }}
                        >
                          Gratis {cardTypeLabels[type]}
                        </motion.span>
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
  index: number; // for staggered slide-in delay
}

const ConsumptionRow: React.FC<ConsumptionRowProps> = ({ title, icon: Icon, count, onInc, onDec, color, bg, index }) => {
  const countControls = useAnimationControls();

  const handleInc = () => {
    onInc();
    // Cheerful little bounce up
    countControls.start({
      y: [0, -8, 3, -3, 0],
      scale: [1, 1.25, 1.1, 1.05, 1],
      transition: { duration: 0.38, ease: 'easeOut' },
    });
  };

  const handleDec = () => {
    if (count === 0) return;
    onDec();
    // Quick drop + shrink — feels like removal
    countControls.start({
      y: [0, 5, -2, 0],
      scale: [1, 0.75, 0.95, 1],
      opacity: [1, 0.4, 0.8, 1],
      transition: { duration: 0.32, ease: 'easeInOut' },
    });
  };

  return (
    <div className="bg-white rounded-[24px] p-4 shadow-sm flex items-center justify-between overflow-hidden">
      <div className="flex items-center gap-4">
        {/* Icon — slides in from right with stagger */}
        <motion.div
          className={cn('w-12 h-12 rounded-full flex items-center justify-center', bg, color)}
          initial={{ x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <Icon size={24} />
        </motion.div>

        {/* Title — slides in from right slightly after icon */}
        <motion.span
          className="font-display font-bold text-xl"
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.55, delay: index * 0.08 + 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
          {title}
        </motion.span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleDec}
          disabled={count === 0}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-50 active:scale-90 transition-transform"
        >
          <Minus size={20} />
        </button>

        {/* Animated count */}
        <motion.span
          animate={countControls}
          className="font-mono text-xl font-medium w-6 text-center inline-block"
        >
          {count}
        </motion.span>

        <button
          onClick={handleInc}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:scale-90 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};
