import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calculateLifetimeConsumptions, resolveLoyaltyTier, type LoyaltyTier } from '../lib/loyalty-tier';
import { getCustomerLoginAlias } from '../lib/customer-accounts';

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
  loginEmail: string;
  loginAlias: string | null;
  createdAt: string;
  cards: Record<CardType, number>;
  rewards: Record<CardType, number>;
  claimedRewards: Record<CardType, number>;
  totalVisits: number;
  lastVisitAt: string | null;
  welcomeBonusClaimed: boolean;
  bonusCardType: CardType | null;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  mustResetPassword: boolean;
  createdByAdminEmail: string | null;
}

export interface AddResult {
  earned: Record<CardType, number>;
  bonusApplied: boolean;
  bonusType?: CardType;
}

export interface TransactionMeta {
  txId?: string;
  staffEmail?: string | null;
}

export interface ManualAdjustmentInput {
  customerId: string;
  staffEmail?: string | null;
  reason: string;
  stamps: Record<CardType, number>;
  rewards: Record<CardType, number>;
  claimedRewards: Record<CardType, number>;
  visitDelta: number;
}

interface LoyaltyContextType {
  customers: Customer[];
  currentCustomer: Customer | null;
  loading: boolean;
  dbError: string | null;
  setCurrentCustomer: (id: string) => void;
  addConsumptions: (customerId: string, consumptions: Record<CardType, number>, meta?: TransactionMeta) => Promise<AddResult>;
  claimReward: (customerId: string, type: CardType, meta?: TransactionMeta) => Promise<boolean>;
  applyManualAdjustment: (input: ManualAdjustmentInput) => Promise<boolean>;
  deleteCustomer: (customerId: string) => Promise<boolean>;
  upsertCustomer: (id: string, name: string, email: string) => Promise<void>;
  refreshCustomers: () => Promise<void>;
}

const emptyCards = (): Record<CardType, number> => ({ coffee: 0, wine: 0, beer: 0, soda: 0 });

function asCardRecord(value: any): Record<CardType, number> {
  return {
    coffee: Number(value?.coffee ?? 0),
    wine: Number(value?.wine ?? 0),
    beer: Number(value?.beer ?? 0),
    soda: Number(value?.soda ?? 0),
  };
}

function rowToCustomer(row: any): Customer {
  const cards = {
    coffee: row.coffee_stamps ?? 0,
    wine: row.wine_stamps ?? 0,
    beer: row.beer_stamps ?? 0,
    soda: row.soda_stamps ?? 0,
  };
  const rewards = {
    coffee: row.coffee_rewards ?? 0,
    wine: row.wine_rewards ?? 0,
    beer: row.beer_rewards ?? 0,
    soda: row.soda_rewards ?? 0,
  };
  const claimedRewards = {
    coffee: row.coffee_claimed ?? 0,
    wine: row.wine_claimed ?? 0,
    beer: row.beer_claimed ?? 0,
    soda: row.soda_claimed ?? 0,
  };
  const fallbackPoints = calculateLifetimeConsumptions({ cards, rewards, claimedRewards });
  const loyaltyPoints = Number.isFinite(Number(row.loyalty_points)) ? Number(row.loyalty_points) : fallbackPoints;
  const loyaltyTier = resolveLoyaltyTier(loyaltyPoints);

  return {
    id: row.id,
    name: row.name,
    email: row.email ?? '',
    loginEmail: row.login_email ?? row.email ?? '',
    loginAlias: getCustomerLoginAlias(row.login_alias, row.login_email ?? row.email ?? ''),
    createdAt: row.created_at ?? new Date().toISOString(),
    cards,
    rewards,
    claimedRewards,
    totalVisits: row.total_visits ?? 0,
    lastVisitAt: row.last_visit_at ?? null,
    welcomeBonusClaimed: row.welcome_bonus_claimed ?? false,
    bonusCardType: (row.bonus_card_type as CardType | null) ?? null,
    loyaltyPoints,
    loyaltyTier,
    mustResetPassword: row.must_reset_password ?? false,
    createdByAdminEmail: row.created_by_admin_email ?? null,
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

    return () => { supabase?.removeChannel(channel); };
  }, []);

  // Keep currentCustomerId pinned to authenticated customer after fetch
  const setCurrentCustomerWithPin = useCallback((id: string) => {
    setCurrentCustomerId(id);
  }, []);

  const upsertCustomer = useCallback(async (id: string, name: string, email: string) => {
    if (!supabase) return;
    const payload = { id, name, email, coffee_stamps: 0, wine_stamps: 0, beer_stamps: 0, soda_stamps: 0,
      login_email: email, login_alias: null,
      coffee_rewards: 0, wine_rewards: 0, beer_rewards: 0, soda_rewards: 0,
      coffee_claimed: 0, wine_claimed: 0, beer_claimed: 0, soda_claimed: 0,
      total_visits: 0, last_visit_at: null, welcome_bonus_claimed: false,
      must_reset_password: false, created_by_admin_email: null };

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

    // Merge duplicate rows (same email, different auth provider e.g. Google vs email)
    await supabase.rpc('merge_customer_by_email', { new_id: id, new_email: email });

    await fetchFromSupabase();
    setCurrentCustomerId(id);
  }, [fetchFromSupabase]);

  const addConsumptions = useCallback(async (
    customerId: string,
    consumptions: Record<CardType, number>,
    meta?: TransactionMeta,
  ): Promise<AddResult> => {
    const earned: Record<CardType, number> = emptyCards();
    let bonusApplied = false;
    if (!supabase) return { earned, bonusApplied };

    const { data, error } = await supabase.rpc('apply_customer_scan', {
      p_customer_id: customerId,
      p_tx_id: meta?.txId ?? `scan-${Date.now()}`,
      p_staff_email: meta?.staffEmail ?? null,
      p_coffee: consumptions.coffee,
      p_wine: consumptions.wine,
      p_beer: consumptions.beer,
      p_soda: consumptions.soda,
    });

    if (error) {
      console.error('apply_customer_scan error:', error);
      throw new Error(error.message || 'Database update mislukt');
    }

    const rpcResult = (data ?? {}) as { earned?: Partial<Record<CardType, number>>; bonusApplied?: boolean; bonusType?: CardType | null };
    const rpcEarned = asCardRecord(rpcResult.earned);
    const rpcBonusApplied = Boolean(rpcResult.bonusApplied);
    const rpcBonusType = rpcResult.bonusType ?? undefined;

    earned.coffee = rpcEarned.coffee;
    earned.wine = rpcEarned.wine;
    earned.beer = rpcEarned.beer;
    earned.soda = rpcEarned.soda;
    bonusApplied = rpcBonusApplied;

    await fetchFromSupabase();

    return { earned, bonusApplied, bonusType: rpcBonusType };
  }, [fetchFromSupabase]);

  const claimReward = useCallback(async (customerId: string, type: CardType, meta?: TransactionMeta): Promise<boolean> => {
    if (!supabase) return false;

    const { error } = await supabase.rpc('claim_customer_reward', {
      p_customer_id: customerId,
      p_card_type: type,
      p_tx_id: meta?.txId ?? `redeem-${Date.now()}`,
      p_staff_email: meta?.staffEmail ?? null,
    });

    if (error) {
      console.error('claim_customer_reward error:', error);
      return false;
    }

    await fetchFromSupabase();
    return true;
  }, [fetchFromSupabase]);

  const applyManualAdjustment = useCallback(async (input: ManualAdjustmentInput): Promise<boolean> => {
    if (!supabase) return false;

    const { error } = await supabase.rpc('apply_manual_adjustment', {
      p_customer_id: input.customerId,
      p_staff_email: input.staffEmail ?? null,
      p_reason: input.reason,
      p_coffee_stamps: input.stamps.coffee,
      p_wine_stamps: input.stamps.wine,
      p_beer_stamps: input.stamps.beer,
      p_soda_stamps: input.stamps.soda,
      p_coffee_rewards: input.rewards.coffee,
      p_wine_rewards: input.rewards.wine,
      p_beer_rewards: input.rewards.beer,
      p_soda_rewards: input.rewards.soda,
      p_coffee_claimed: input.claimedRewards.coffee,
      p_wine_claimed: input.claimedRewards.wine,
      p_beer_claimed: input.claimedRewards.beer,
      p_soda_claimed: input.claimedRewards.soda,
      p_visit_delta: input.visitDelta,
    });

    if (error) {
      console.error('apply_manual_adjustment error:', error);
      throw new Error(error.message || 'Correctie opslaan mislukt');
    }

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

  const value = useMemo(() => ({
    customers, currentCustomer, loading, dbError,
    setCurrentCustomer: setCurrentCustomerWithPin,
    addConsumptions, claimReward, applyManualAdjustment, deleteCustomer, upsertCustomer, refreshCustomers,
  }), [
    customers,
    currentCustomer,
    loading,
    dbError,
    setCurrentCustomerWithPin,
    addConsumptions,
    claimReward,
    applyManualAdjustment,
    deleteCustomer,
    upsertCustomer,
    refreshCustomers,
  ]);

  return (
    <LoyaltyContext.Provider value={value}>
      {children}
    </LoyaltyContext.Provider>
  );
};

export const useLoyalty = () => {
  const ctx = useContext(LoyaltyContext);
  if (!ctx) throw new Error('useLoyalty must be used within LoyaltyProvider');
  return ctx;
};
