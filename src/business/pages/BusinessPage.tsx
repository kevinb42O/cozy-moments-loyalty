import React, { useState, useEffect } from 'react';
import { Coffee, Wine, Beer, Plus, Minus, QrCode, LogOut } from 'lucide-react';
import { useBusinessAuth } from '../store/BusinessAuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { useLoyalty, CardType, cardTypeLabels } from '../../shared/store/LoyaltyContext';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export const BusinessPage: React.FC = () => {
  const { customers } = useLoyalty();
  const { logout } = useBusinessAuth();
  const [consumptions, setConsumptions] = useState<Record<CardType, number>>({
    coffee: 0,
    wine: 0,
    beer: 0,
  });
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [view, setView] = useState<'create' | 'customers' | 'redeem'>('create');

  const handleIncrement = (type: CardType) => {
    setConsumptions(prev => ({ ...prev, [type]: prev[type] + 1 }));
  };

  const handleDecrement = (type: CardType) => {
    setConsumptions(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
  };

  const generateQR = () => {
    if (consumptions.coffee === 0 && consumptions.wine === 0 && consumptions.beer === 0) return;
    
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
  };

  // Auto-reset QR after 60 seconds so it can't be reused
  useEffect(() => {
    if (!qrPayload) return;
    const t = setTimeout(() => reset(), 60_000);
    return () => clearTimeout(t);
  }, [qrPayload]);

  const totalConsumptions = consumptions.coffee + consumptions.wine + consumptions.beer;

  return (
    <div className="min-h-screen bg-[#f5f5f0] pb-24">
      <header className="bg-white px-6 py-6 rounded-b-[40px] shadow-sm mb-8 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="w-10" />
          <div className="flex items-center gap-2">
            <img src="/cozylogo.png" alt="COZY Moments" className="w-16 h-16 object-contain" />
          </div>
          <button
            onClick={logout}
            title="Uitloggen"
            className="w-10 h-10 bg-gray-100 hover:bg-red-50 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"
          >
            <LogOut size={18} />
          </button>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-full mt-6">
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

                <button
                  onClick={generateQR}
                  disabled={totalConsumptions === 0}
                  className={cn(
                    "w-full mt-8 rounded-full py-4 px-6 shadow-lg flex items-center justify-center gap-3 transition-all",
                    totalConsumptions > 0 
                      ? "bg-[#1a1a1a] text-white hover:bg-[#333] active:scale-[0.98]" 
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  )}
                >
                  <QrCode size={24} />
                  <span className="font-serif font-semibold text-lg tracking-wide">Genereer QR Code</span>
                </button>
              </div>
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
            <h2 className="text-3xl font-serif font-semibold text-[var(--color-cozy-text)] mb-6">
              Klanten Overzicht
            </h2>
            
            {customers.map(customer => (
              <div key={customer.id} className="bg-white rounded-[24px] p-5 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-serif font-bold text-xl">
                    {customer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-lg">{customer.name}</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Klant ID: {customer.id}</p>
                  </div>
                </div>
                
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-1">Stempelkaart</p>
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
            ))}
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
