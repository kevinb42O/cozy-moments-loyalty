import { describe, expect, it } from 'vitest';
import {
  buildTransactionSummaryParts,
  emptyDeltaRecord,
  getTransactionLabel,
  hasManualAdjustmentChanges,
  rowToTransaction,
  validateManualAdjustmentDraft,
} from '../business/lib/transaction-history';

describe('Transaction history helpers', () => {
  it('should map a raw Supabase row into a UI transaction object', () => {
    const row = {
      id: 42,
      customer_id: 'cust-1',
      event_type: 'scan',
      staff_email: 'bar@cozy.com',
      reason: 'Welkomstbonus automatisch toegepast',
      tx_id: 'scan-123',
      coffee_stamp_delta: 4,
      wine_stamp_delta: 0,
      beer_stamp_delta: 1,
      soda_stamp_delta: 0,
      coffee_reward_delta: 1,
      wine_reward_delta: 0,
      beer_reward_delta: 0,
      soda_reward_delta: 0,
      coffee_claimed_delta: 0,
      wine_claimed_delta: 0,
      beer_claimed_delta: 0,
      soda_claimed_delta: 0,
      visit_delta: 1,
      metadata: { bonusApplied: true },
      created_at: '2026-03-09T12:00:00.000Z',
      customers: { name: 'Lisa', email: 'lisa@example.com', created_by_admin_email: 'owner@cozy.com' },
    };

    const mapped = rowToTransaction(row);

    expect(mapped.id).toBe(42);
    expect(mapped.customerName).toBe('Lisa');
    expect(mapped.customerEmail).toBe('lisa@example.com');
    expect(mapped.stampDelta.coffee).toBe(4);
    expect(mapped.rewardDelta.coffee).toBe(1);
    expect(mapped.visitDelta).toBe(1);
    expect(mapped.isManagedCustomer).toBe(true);
    expect(mapped.customerCreatedByAdminEmail).toBe('owner@cozy.com');
  });

  it('should create readable summary chips for mixed transaction deltas', () => {
    const transaction = rowToTransaction({
      id: 5,
      customer_id: 'cust-2',
      event_type: 'adjustment',
      staff_email: 'sixtine@cozy.com',
      reason: 'Scan gecorrigeerd',
      tx_id: null,
      coffee_stamp_delta: -2,
      wine_stamp_delta: 0,
      beer_stamp_delta: 0,
      soda_stamp_delta: 0,
      coffee_reward_delta: 1,
      wine_reward_delta: 0,
      beer_reward_delta: 0,
      soda_reward_delta: 0,
      coffee_claimed_delta: 0,
      wine_claimed_delta: 0,
      beer_claimed_delta: 0,
      soda_claimed_delta: 0,
      visit_delta: -1,
      metadata: {},
      created_at: '2026-03-09T12:00:00.000Z',
      customers: { name: 'Jan', email: 'jan@example.com' },
    });

    expect(buildTransactionSummaryParts(transaction)).toEqual([
      '-2 koffie-stempels',
      '+1 koffie-beloningen',
      '-1 bezoeken',
    ]);
  });

  it('should expose human labels for every event type', () => {
    expect(getTransactionLabel('scan')).toBe('Scan');
    expect(getTransactionLabel('redeem')).toBe('Inwisseling');
    expect(getTransactionLabel('adjustment')).toBe('Correctie');
  });
});

describe('Manual adjustment validation', () => {
  const baseDraft = {
    customerId: 'cust-1',
    reason: 'Foutieve scan aan de toog',
    stamps: emptyDeltaRecord(),
    rewards: emptyDeltaRecord(),
    claimedRewards: emptyDeltaRecord(),
    visitDelta: 0,
  };

  it('should reject a draft without customer', () => {
    expect(validateManualAdjustmentDraft({ ...baseDraft, customerId: '' })).toBe('Kies eerst een klant voor de correctie.');
  });

  it('should reject a draft without reason', () => {
    expect(validateManualAdjustmentDraft({ ...baseDraft, reason: '   ' })).toBe('Geef altijd een reden op voor de correctie.');
  });

  it('should reject a draft without any delta', () => {
    expect(validateManualAdjustmentDraft(baseDraft)).toBe('Voeg minstens 1 aanpassing toe.');
  });

  it('should accept a draft with a stamp correction', () => {
    const draft = {
      ...baseDraft,
      stamps: { ...emptyDeltaRecord(), coffee: -1 },
    };

    expect(hasManualAdjustmentChanges(draft)).toBe(true);
    expect(validateManualAdjustmentDraft(draft)).toBeNull();
  });

  it('should accept a draft with a visit correction only', () => {
    const draft = {
      ...baseDraft,
      visitDelta: 1,
    };

    expect(hasManualAdjustmentChanges(draft)).toBe(true);
    expect(validateManualAdjustmentDraft(draft)).toBeNull();
  });
});
