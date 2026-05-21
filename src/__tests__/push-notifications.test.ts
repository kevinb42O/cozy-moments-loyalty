import { describe, expect, it } from 'vitest';
import {
  buildPushAudienceWarnings,
  estimatePushAudience,
  estimatePushAudienceWithActiveSubscriptions,
  matchesPushAudience,
  normalizePushPreferences,
  type CustomerPushPreferences,
} from '../shared/lib/push-notifications';
import type { Customer } from '../shared/store/LoyaltyContext';

function customer(overrides: Partial<Customer>): Customer {
  return {
    id: 'customer-1',
    name: 'Test Customer',
    email: 'test@example.com',
    loginEmail: 'test@example.com',
    loginAlias: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    cards: { coffee: 0, wine: 0, beer: 0, soda: 0 },
    rewards: { coffee: 0, wine: 0, beer: 0, soda: 0 },
    claimedRewards: { coffee: 0, wine: 0, beer: 0, soda: 0 },
    totalVisits: 0,
    lastVisitAt: null,
    welcomeBonusClaimed: false,
    bonusCardType: null,
    loyaltyPoints: 0,
    loyaltyTier: 'bronze',
    mustResetPassword: false,
    createdByAdminEmail: null,
    ...overrides,
  };
}

function preferences(customerId: string, overrides: Partial<CustomerPushPreferences> = {}) {
  return normalizePushPreferences({
    customerId,
    pushEnabled: true,
    promoOptIn: false,
    rewardOptIn: true,
    reminderOptIn: true,
    ...overrides,
  }, customerId);
}

describe('push notification audience helpers', () => {
  it('only estimates customers with push enabled and matching reward state', () => {
    const customers = [
      customer({ id: 'reward', rewards: { coffee: 1, wine: 0, beer: 0, soda: 0 } }),
      customer({ id: 'no-reward' }),
      customer({ id: 'disabled', rewards: { coffee: 1, wine: 0, beer: 0, soda: 0 } }),
    ];

    const result = estimatePushAudience(customers, [
      preferences('reward'),
      preferences('no-reward'),
      preferences('disabled', { pushEnabled: false }),
    ], { requiresReward: true });

    expect(result.map((entry) => entry.id)).toEqual(['reward']);
  });

  it('only counts deliverable recipients with an active push subscription', () => {
    const customers = [
      customer({ id: 'active', rewards: { coffee: 1, wine: 0, beer: 0, soda: 0 } }),
      customer({ id: 'preference-only', rewards: { coffee: 1, wine: 0, beer: 0, soda: 0 } }),
      customer({ id: 'disabled', rewards: { coffee: 1, wine: 0, beer: 0, soda: 0 } }),
    ];

    const result = estimatePushAudienceWithActiveSubscriptions(customers, [
      preferences('active'),
      preferences('preference-only'),
      preferences('disabled', { pushEnabled: false }),
    ], ['active', 'disabled'], { requiresReward: true });

    expect(result.map((entry) => entry.id)).toEqual(['active']);
  });

  it('requires explicit promo opt-in for promotional audiences', () => {
    const warnings = buildPushAudienceWarnings({
      estimatedRecipients: 12,
      deliveryCategory: 'promo',
      filters: { favoriteDrinkTypes: ['wine'] },
    });

    expect(warnings).toContain('Promoties horen alleen naar klanten met expliciete promo-opt-in te gaan.');
  });

  it('matches inactivity reminders only after the threshold', () => {
    const now = Date.parse('2026-05-19T12:00:00.000Z');
    const customers = [
      customer({ id: 'inactive', totalVisits: 4, lastVisitAt: '2026-04-01T12:00:00.000Z' }),
      customer({ id: 'recent', totalVisits: 4, lastVisitAt: '2026-05-10T12:00:00.000Z' }),
    ];

    const result = customers.filter((entry) => matchesPushAudience(
      entry,
      preferences(entry.id),
      { inactivityDays: 30, minVisits: 3 },
      now,
    ));

    expect(result.map((entry) => entry.id)).toEqual(['inactive']);
  });
});
