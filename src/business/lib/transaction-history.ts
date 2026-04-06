import type { CardType } from '../../shared/store/LoyaltyContext';
import { cardTypeLabels } from '../../shared/store/LoyaltyContext';
import { getCustomerContactLabel } from '../../shared/lib/customer-accounts';

export type TransactionEventType = 'scan' | 'redeem' | 'adjustment';

export interface CustomerTransaction {
  id: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  eventType: TransactionEventType;
  staffEmail: string | null;
  reason: string | null;
  txId: string | null;
  stampDelta: Record<CardType, number>;
  rewardDelta: Record<CardType, number>;
  claimedDelta: Record<CardType, number>;
  visitDelta: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ManualAdjustmentDraft {
  customerId: string;
  reason: string;
  stamps: Record<CardType, number>;
  rewards: Record<CardType, number>;
  claimedRewards: Record<CardType, number>;
  visitDelta: number;
}

export function emptyDeltaRecord(): Record<CardType, number> {
  return { coffee: 0, wine: 0, beer: 0, soda: 0 };
}

export function rowToTransaction(row: any): CustomerTransaction {
  const customerRelation = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  return {
    id: Number(row.id),
    customerId: row.customer_id,
    customerName: customerRelation?.name ?? 'Onbekende klant',
    customerEmail: getCustomerContactLabel(
      customerRelation?.email ?? '',
      customerRelation?.login_alias ?? null,
      customerRelation?.login_email ?? '',
    ),
    eventType: row.event_type,
    staffEmail: row.staff_email ?? null,
    reason: row.reason ?? null,
    txId: row.tx_id ?? null,
    stampDelta: {
      coffee: row.coffee_stamp_delta ?? 0,
      wine: row.wine_stamp_delta ?? 0,
      beer: row.beer_stamp_delta ?? 0,
      soda: row.soda_stamp_delta ?? 0,
    },
    rewardDelta: {
      coffee: row.coffee_reward_delta ?? 0,
      wine: row.wine_reward_delta ?? 0,
      beer: row.beer_reward_delta ?? 0,
      soda: row.soda_reward_delta ?? 0,
    },
    claimedDelta: {
      coffee: row.coffee_claimed_delta ?? 0,
      wine: row.wine_claimed_delta ?? 0,
      beer: row.beer_claimed_delta ?? 0,
      soda: row.soda_claimed_delta ?? 0,
    },
    visitDelta: row.visit_delta ?? 0,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdAt: row.created_at,
  };
}

export function getTransactionLabel(eventType: TransactionEventType) {
  if (eventType === 'scan') return 'Scan';
  if (eventType === 'redeem') return 'Inwisseling';
  return 'Correctie';
}

export function buildTransactionSummaryParts(transaction: CustomerTransaction) {
  const parts: string[] = [];

  (Object.keys(transaction.stampDelta) as CardType[]).forEach((type) => {
    const value = transaction.stampDelta[type];
    if (value !== 0) {
      parts.push(formatSignedCount(value, `${cardTypeLabels[type].toLowerCase()}-stempels`));
    }
  });

  (Object.keys(transaction.rewardDelta) as CardType[]).forEach((type) => {
    const value = transaction.rewardDelta[type];
    if (value !== 0) {
      parts.push(formatSignedCount(value, `${cardTypeLabels[type].toLowerCase()}-beloningen`));
    }
  });

  (Object.keys(transaction.claimedDelta) as CardType[]).forEach((type) => {
    const value = transaction.claimedDelta[type];
    if (value !== 0) {
      parts.push(formatSignedCount(value, `${cardTypeLabels[type].toLowerCase()} ingewisseld`));
    }
  });

  if (transaction.visitDelta !== 0) {
    parts.push(formatSignedCount(transaction.visitDelta, 'bezoeken'));
  }

  return parts;
}

export function hasManualAdjustmentChanges(draft: ManualAdjustmentDraft) {
  return draft.visitDelta !== 0
    || Object.values(draft.stamps).some(value => value !== 0)
    || Object.values(draft.rewards).some(value => value !== 0)
    || Object.values(draft.claimedRewards).some(value => value !== 0);
}

export function validateManualAdjustmentDraft(draft: ManualAdjustmentDraft) {
  if (!draft.customerId) {
    return 'Kies eerst een klant voor de correctie.';
  }

  if (!draft.reason.trim()) {
    return 'Geef altijd een reden op voor de correctie.';
  }

  if (!hasManualAdjustmentChanges(draft)) {
    return 'Voeg minstens 1 aanpassing toe.';
  }

  return null;
}

function formatSignedCount(value: number, suffix: string) {
  return `${value > 0 ? '+' : ''}${value} ${suffix}`;
}
