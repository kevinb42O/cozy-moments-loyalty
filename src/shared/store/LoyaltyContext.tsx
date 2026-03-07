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
  totalVisits: number;
  lastVisitAt: string | null;
  welcomeBonusClaimed: boolean;
  bonusCardType: CardType | null;
}

export interface AddResult {
  earned: Record<CardType, number>;
  bonusApplied: boolean;
  bonusType?: CardType;
}

interface LoyaltyContextType {
  customers: Customer[];
  currentCustomer: Customer | null;
  loading: boolean;
  dbError: string | null;
  setCurrentCustomer: (id: string) => void;
  addConsumptions: (customerId: string, consumptions: Record<CardType, number>) => Promise<AddResult>;
  claimReward: (customerId: string, type: CardType) => Promise<boolean>;
  deleteCustomer: (customerId: string) => Promise<boolean>;
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
    totalVisits: row.total_visits ?? 0,
    lastVisitAt: row.last_visit_at ?? null,
    welcomeBonusClaimed: row.welcome_bonus_claimed ?? false,
    bonusCardType: (row.bonus_card_type as CardType | null) ?? null,
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
    const payload = { id, name, email, coffee_stamps: 0, wine_stamps: 0, beer_stamps: 0, soda_stamps: 0,
      coffee_rewards: 0, wine_rewards: 0, beer_rewards: 0, soda_rewards: 0,
      coffee_claimed: 0, wine_claimed: 0, beer_claimed: 0, soda_claimed: 0,
      total_visits: 0, last_visit_at: null, welcome_bonus_claimed: false };

    const { error } = await supabase.from('customers').upsert(
      payload,
      { onConflict: 'id', ignoreDuplicates: true }
    );
    if (error) {
      console.error('upsertCustomer error (attempt 1):', error);
      // Retry once after short delay
      await new Promise(r => setTimeout(r, 800));
      const { error: retryErr } = await supabase.from('customers').upsert(
        payload,
        { onConflict: 'id', ignoreDuplicates: true }
      );
      if (retryErr) console.error('upsertCustomer error (attempt 2):', retryErr);
    }
    await fetchFromSupabase();
    setCurrentCustomerId(id);
  }, [fetchFromSupabase]);

  const addConsumptions = useCallback(async (
    customerId: string,
    consumptions: Record<CardType, number>
  ): Promise<AddResult> => {
    const earned: Record<CardType, number> = emptyCards();
    let bonusApplied = false;
    if (!supabase) return { earned, bonusApplied };

    // Always fetch fresh customer data from DB to avoid stale closure issues
    const { data: row, error: fetchErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (fetchErr || !row) {
      console.error('addConsumptions: customer not found in DB', fetchErr);
      return { earned, bonusApplied };
    }

    const customer = rowToCustomer(row);
    const newCards = { ...customer.cards };
    const newRewards = { ...customer.rewards };

    // Welcome bonus: +2 extra stamps on first-ever transaction
    const applyBonus = !customer.welcomeBonusClaimed;
    const actualConsumptions = { ...consumptions };
    let bonusCardType: CardType | undefined;
    if (applyBonus) {
      // Find the first category with stamps to apply the bonus to
      const foundType = (Object.keys(actualConsumptions) as CardType[]).find(
        type => actualConsumptions[type] > 0
      );
      if (foundType) {
        bonusCardType = foundType;
        actualConsumptions[foundType] += 2;
        bonusApplied = true;
      }
    }

    (Object.keys(actualConsumptions) as CardType[]).forEach(type => {
      if (actualConsumptions[type] <= 0) return;
      const total = newCards[type] + actualConsumptions[type];
      const rewardsEarned = Math.floor(total / 10);
      earned[type] = rewardsEarned;
      newCards[type] = total % 10;
      if (rewardsEarned > 0) newRewards[type] = (newRewards[type] || 0) + rewardsEarned;
    });

    const updatePayload: Record<string, unknown> = {
      coffee_stamps: newCards.coffee, wine_stamps: newCards.wine, beer_stamps: newCards.beer, soda_stamps: newCards.soda,
      coffee_rewards: newRewards.coffee, wine_rewards: newRewards.wine, beer_rewards: newRewards.beer, soda_rewards: newRewards.soda,
      total_visits: (customer.totalVisits || 0) + 1,
      last_visit_at: new Date().toISOString(),
    };
    if (bonusApplied) {
      updatePayload.welcome_bonus_claimed = true;
      updatePayload.bonus_card_type = bonusCardType;
    }

    const { error } = await supabase.from('customers').update(updatePayload).eq('id', customerId);

    if (error) {
      console.error('Supabase update error:', error);
      throw new Error('Database update mislukt');
    }

    // Optimistic update so UI responds instantly, then sync from DB
    setCustomers(prev => prev.map(c =>
      c.id === customerId ? { ...c, cards: newCards, rewards: newRewards, totalVisits: (c.totalVisits || 0) + 1, lastVisitAt: new Date().toISOString(), welcomeBonusClaimed: bonusApplied ? true : c.welcomeBonusClaimed, bonusCardType: bonusApplied ? (bonusCardType ?? null) : c.bonusCardType } : c
    ));
    await fetchFromSupabase();

    return { earned, bonusApplied, bonusType: bonusCardType };
  }, [fetchFromSupabase]);

  const claimReward = useCallback(async (customerId: string, type: CardType): Promise<boolean> => {
    if (!supabase) return false;

    // Fetch fresh data from DB to avoid stale closure
    const { data: row, error: fetchErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (fetchErr || !row) return false;
    const customer = rowToCustomer(row);
    if ((customer.rewards[type] || 0) <= 0) return false;

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
  }, [fetchFromSupabase]);

  const deleteCustomer = useCallback(async (customerId: string): Promise<boolean> => {
    if (!supabase) return false;

    const { error } = await supabase.rpc('delete_customer_account', { customer_id: customerId });
    if (error) {
      console.error('deleteCustomer error:', error);
      return false;
    }

    setCustomers(prev => prev.filter(c => c.id !== customerId));
    await fetchFromSupabase();
    return true;
  }, [fetchFromSupabase]);

  const currentCustomer = customers.find(c => c.id === currentCustomerId) ?? null;

  const refreshCustomers = useCallback(async () => {
    await fetchFromSupabase();
  }, [fetchFromSupabase]);

  return (
    <LoyaltyContext.Provider value={{
      customers, currentCustomer, loading, dbError,
      setCurrentCustomer: setCurrentCustomerWithPin,
      addConsumptions, claimReward, deleteCustomer, upsertCustomer, refreshCustomers,
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
