import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type CardType = 'coffee' | 'wine' | 'beer' | 'soda';

export const cardTypeLabels: Record<CardType, string> = {
  coffee: 'Koffie',
  wine: 'Wijn',
  beer: 'Bier',
  soda: 'Frisdrank',
};

export interface Customer {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  cards: Record<CardType, number>;
  rewards: Record<CardType, number>;
  claimedRewards: Record<CardType, number>;
}

export interface AddResult {
  earned: Record<CardType, number>;
}

interface LoyaltyContextType {
  customers: Customer[];
  currentCustomer: Customer | null;
  loading: boolean;
  dbError: string | null;
  setCurrentCustomer: (id: string) => void;
  addConsumptions: (customerId: string, consumptions: Record<CardType, number>) => Promise<AddResult>;
  claimReward: (customerId: string, type: CardType) => Promise<boolean>;
  upsertCustomer: (id: string, name: string, email: string) => Promise<void>;
  refreshCustomers: () => Promise<void>;
}

const emptyCards = (): Record<CardType, number> => ({ coffee: 0, wine: 0, beer: 0, soda: 0 });

function rowToCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? '',
    createdAt: row.created_at ?? new Date().toISOString(),
    cards: { coffee: row.coffee_stamps ?? 0, wine: row.wine_stamps ?? 0, beer: row.beer_stamps ?? 0, soda: row.soda_stamps ?? 0 },
    rewards: { coffee: row.coffee_rewards ?? 0, wine: row.wine_rewards ?? 0, beer: row.beer_rewards ?? 0, soda: row.soda_rewards ?? 0 },
    claimedRewards: { coffee: row.coffee_claimed ?? 0, wine: row.wine_claimed ?? 0, beer: row.beer_claimed ?? 0, soda: row.soda_claimed ?? 0 },
  };
}

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);

export const LoyaltyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentCustomerId, setCurrentCustomerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const fetchFromSupabase = useCallback(async () => {
    if (!supabase) { setDbError('Supabase niet geconfigureerd'); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from('customers').select('*').order('created_at');
    if (error) {
      console.error('Supabase fetch error:', error);
      setDbError(error.message);
      setLoading(false);
    } else {
      setDbError(null);
      const rows = (data ?? []).map(rowToCustomer);
      setCustomers(rows);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFromSupabase();

    if (!supabase) return;
    const channel = supabase
      .channel('customers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        fetchFromSupabase();
      })
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, []);

  // Keep currentCustomerId pinned to authenticated customer after fetch
  const setCurrentCustomerWithPin = useCallback((id: string) => {
    setCurrentCustomerId(id);
  }, []);

  const upsertCustomer = useCallback(async (id: string, name: string, email: string) => {
    if (!supabase) return;
    await supabase.from('customers').upsert(
      { id, name, email, coffee_stamps: 0, wine_stamps: 0, beer_stamps: 0, soda_stamps: 0,
        coffee_rewards: 0, wine_rewards: 0, beer_rewards: 0, soda_rewards: 0,
        coffee_claimed: 0, wine_claimed: 0, beer_claimed: 0, soda_claimed: 0 },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    await fetchFromSupabase();
    setCurrentCustomerId(id);
  }, [fetchFromSupabase]);

  const addConsumptions = useCallback(async (
    customerId: string,
    consumptions: Record<CardType, number>
  ): Promise<AddResult> => {
    const earned: Record<CardType, number> = emptyCards();
    if (!supabase) return { earned };

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return { earned };

    const newCards = { ...customer.cards };
    const newRewards = { ...customer.rewards };

    (Object.keys(consumptions) as CardType[]).forEach(type => {
      if (consumptions[type] <= 0) return;
      const total = newCards[type] + consumptions[type];
      const rewardsEarned = Math.floor(total / 10);
      earned[type] = rewardsEarned;
      newCards[type] = total % 10;
      if (rewardsEarned > 0) newRewards[type] = (newRewards[type] || 0) + rewardsEarned;
    });

    const { error } = await supabase.from('customers').update({
      coffee_stamps: newCards.coffee, wine_stamps: newCards.wine, beer_stamps: newCards.beer, soda_stamps: newCards.soda,
      coffee_rewards: newRewards.coffee, wine_rewards: newRewards.wine, beer_rewards: newRewards.beer, soda_rewards: newRewards.soda,
    }).eq('id', customerId);

    if (error) {
      console.error('Supabase update error:', error);
    } else {
      // Optimistic update so UI responds instantly, then sync from DB
      setCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, cards: newCards, rewards: newRewards } : c
      ));
      await fetchFromSupabase();
    }

    return { earned };
  }, [customers, fetchFromSupabase]);

  const claimReward = useCallback(async (customerId: string, type: CardType): Promise<boolean> => {
    if (!supabase) return false;
    const customer = customers.find(c => c.id === customerId);
    if (!customer || (customer.rewards[type] || 0) <= 0) return false;

    const newRewards = { ...customer.rewards, [type]: customer.rewards[type] - 1 };
    const newClaimed = { ...customer.claimedRewards, [type]: (customer.claimedRewards[type] || 0) + 1 };

    const { error } = await supabase.from('customers').update({
      [`${type}_rewards`]: newRewards[type],
      [`${type}_claimed`]: newClaimed[type],
    }).eq('id', customerId);

    if (error) { console.error(error); return false; }

    setCustomers(prev => prev.map(c =>
      c.id === customerId ? { ...c, rewards: newRewards, claimedRewards: newClaimed } : c
    ));
    await fetchFromSupabase();
    return true;
  }, [customers, fetchFromSupabase]);

  const currentCustomer = customers.find(c => c.id === currentCustomerId) ?? null;

  const refreshCustomers = useCallback(async () => {
    await fetchFromSupabase();
  }, [fetchFromSupabase]);

  return (
    <LoyaltyContext.Provider value={{
      customers, currentCustomer, loading, dbError,
      setCurrentCustomer: setCurrentCustomerWithPin,
      addConsumptions, claimReward, upsertCustomer, refreshCustomers,
    }}>
      {children}
    </LoyaltyContext.Provider>
  );
};

export const useLoyalty = () => {
  const ctx = useContext(LoyaltyContext);
  if (!ctx) throw new Error('useLoyalty must be used within LoyaltyProvider');
  return ctx;
};
