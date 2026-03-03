import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_READY } from '../lib/supabase';

export type CardType = 'coffee' | 'wine' | 'beer';

export const cardTypeLabels: Record<CardType, string> = {
  coffee: 'Koffie',
  wine: 'Wijn',
  beer: 'Bier',
};

export interface Customer {
  id: string;
  name: string;
  email: string;
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
  setCurrentCustomer: (id: string) => void;
  addConsumptions: (customerId: string, consumptions: Record<CardType, number>) => Promise<AddResult>;
  claimReward: (customerId: string, type: CardType) => Promise<boolean>;
  upsertCustomer: (id: string, name: string, email: string) => Promise<void>;
  refreshCustomers: () => Promise<void>;
}

const emptyCards = (): Record<CardType, number> => ({ coffee: 0, wine: 0, beer: 0 });
const LOCAL_KEY = 'cozy-customers';

const defaultCustomers: Customer[] = [
  { id: 'c1', name: 'Emma de Vries', email: 'emma@demo.be', cards: { coffee: 8, wine: 2, beer: 0 }, rewards: emptyCards(), claimedRewards: emptyCards() },
  { id: 'c2', name: 'Lars Jansen', email: 'lars@demo.be', cards: { coffee: 3, wine: 9, beer: 5 }, rewards: emptyCards(), claimedRewards: emptyCards() },
  { id: 'c3', name: 'Sophie Bakker', email: 'sophie@demo.be', cards: { coffee: 0, wine: 0, beer: 9 }, rewards: emptyCards(), claimedRewards: emptyCards() },
];

function rowToCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? '',
    cards: { coffee: row.coffee_stamps ?? 0, wine: row.wine_stamps ?? 0, beer: row.beer_stamps ?? 0 },
    rewards: { coffee: row.coffee_rewards ?? 0, wine: row.wine_rewards ?? 0, beer: row.beer_rewards ?? 0 },
    claimedRewards: { coffee: row.coffee_claimed ?? 0, wine: row.wine_claimed ?? 0, beer: row.beer_claimed ?? 0 },
  };
}

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);

export const LoyaltyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentCustomerId, setCurrentCustomerId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (SUPABASE_READY && supabase) {
      fetchFromSupabase();

      // Realtime subscription — any insert/update/delete on customers table
      // will trigger a fresh fetch so both admin and customer views stay current.
      const channel = supabase!
        .channel('customers-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
          fetchFromSupabase();
        })
        .subscribe();

      return () => { supabase!.removeChannel(channel); };
    } else {
      loadFromLocalStorage();
    }
  }, []);

  const fetchFromSupabase = async () => {
    setLoading(true);
    const { data, error } = await supabase!.from('customers').select('*').order('created_at');
    if (error) {
      console.error('Supabase fetch error:', error);
      loadFromLocalStorage();
    } else {
      const rows = (data ?? []).map(rowToCustomer);
      setCustomers(rows);
      if (rows.length > 0) setCurrentCustomerId(rows[0].id);
      setLoading(false);
    }
  };

  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      const parsed: Customer[] = saved ? JSON.parse(saved) : defaultCustomers;
      const migrated = parsed.map(c => ({
        ...c,
        email: (c as any).email ?? '',
        rewards: c.rewards ?? emptyCards(),
        claimedRewards: c.claimedRewards ?? emptyCards(),
      }));
      setCustomers(migrated);
      setCurrentCustomerId(migrated[0]?.id ?? '');
    } catch {
      setCustomers(defaultCustomers);
      setCurrentCustomerId(defaultCustomers[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!SUPABASE_READY && customers.length > 0) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(customers));
    }
  }, [customers]);

  const upsertCustomer = useCallback(async (id: string, name: string, email: string) => {
    if (SUPABASE_READY && supabase) {
      await supabase!.from('customers').upsert(
        { id, name, email, coffee_stamps: 0, wine_stamps: 0, beer_stamps: 0,
          coffee_rewards: 0, wine_rewards: 0, beer_rewards: 0,
          coffee_claimed: 0, wine_claimed: 0, beer_claimed: 0 },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      await fetchFromSupabase();
      setCurrentCustomerId(id); // always pin to the authenticated user
    } else {
      setCustomers(prev => {
        if (prev.find(c => c.id === id)) return prev;
        return [...prev, { id, name, email, cards: emptyCards(), rewards: emptyCards(), claimedRewards: emptyCards() }];
      });
      setCurrentCustomerId(id);
    }
  }, [customers]);

  const addConsumptions = useCallback(async (
    customerId: string,
    consumptions: Record<CardType, number>
  ): Promise<AddResult> => {
    const customer = customers.find(c => c.id === customerId);
    const earned: Record<CardType, number> = emptyCards();
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

    if (SUPABASE_READY && supabase) {
      const { error } = await supabase!.from('customers').update({
        coffee_stamps: newCards.coffee, wine_stamps: newCards.wine, beer_stamps: newCards.beer,
        coffee_rewards: newRewards.coffee, wine_rewards: newRewards.wine, beer_rewards: newRewards.beer,
      }).eq('id', customerId);
      if (error) console.error('Supabase update error:', error);
      else await fetchFromSupabase();
    } else {
      setCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, cards: newCards, rewards: newRewards } : c
      ));
    }

    return { earned };
  }, [customers]);

  const claimReward = useCallback(async (customerId: string, type: CardType): Promise<boolean> => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer || (customer.rewards[type] || 0) <= 0) return false;

    const newRewards = { ...customer.rewards, [type]: customer.rewards[type] - 1 };
    const newClaimed = { ...customer.claimedRewards, [type]: (customer.claimedRewards[type] || 0) + 1 };

    if (SUPABASE_READY && supabase) {
      const { error } = await supabase!.from('customers').update({
        [`${type}_rewards`]: newRewards[type],
        [`${type}_claimed`]: newClaimed[type],
      }).eq('id', customerId);
      if (error) { console.error(error); return false; }
      await fetchFromSupabase();
    } else {
      setCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, rewards: newRewards, claimedRewards: newClaimed } : c
      ));
    }

    return true;
  }, [customers]);

  const currentCustomer = customers.find(c => c.id === currentCustomerId) ?? null;

  const refreshCustomers = useCallback(async () => {
    if (SUPABASE_READY && supabase) {
      await fetchFromSupabase();
    }
  }, []);

  return (
    <LoyaltyContext.Provider value={{
      customers, currentCustomer, loading,
      setCurrentCustomer: setCurrentCustomerId,
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
