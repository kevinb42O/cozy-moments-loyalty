import { describe, expect, it } from 'vitest';
import {
  formatCustomerBirthday,
  getBirthdayReminders,
  normalizeBirthdayInput,
} from '../shared/lib/customer-birthday';
import type { Customer } from '../shared/store/LoyaltyContext';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: overrides.id ?? 'cust-1',
    name: overrides.name ?? 'Maria',
    email: overrides.email ?? '',
    loginEmail: overrides.loginEmail ?? '',
    loginAlias: overrides.loginAlias ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T10:00:00.000Z',
    cards: overrides.cards ?? { coffee: 0, wine: 0, beer: 0, soda: 0 },
    rewards: overrides.rewards ?? { coffee: 0, wine: 0, beer: 0, soda: 0 },
    claimedRewards: overrides.claimedRewards ?? { coffee: 0, wine: 0, beer: 0, soda: 0 },
    totalVisits: overrides.totalVisits ?? 0,
    lastVisitAt: overrides.lastVisitAt ?? null,
    welcomeBonusClaimed: overrides.welcomeBonusClaimed ?? false,
    bonusCardType: overrides.bonusCardType ?? null,
    birthdayDay: overrides.birthdayDay ?? null,
    birthdayMonth: overrides.birthdayMonth ?? null,
    birthdayYear: overrides.birthdayYear ?? null,
    loyaltyPoints: overrides.loyaltyPoints ?? 0,
    loyaltyTier: overrides.loyaltyTier ?? 'bronze',
    mustResetPassword: overrides.mustResetPassword ?? false,
    createdByAdminEmail: overrides.createdByAdminEmail ?? null,
  };
}

describe('customer birthday helpers', () => {
  it('formats birthdays with an optional year', () => {
    expect(formatCustomerBirthday(customer({ birthdayDay: 23, birthdayMonth: 5 }))).toBe('23 mei');
    expect(formatCustomerBirthday(customer({ birthdayDay: 23, birthdayMonth: 5, birthdayYear: 1988 }))).toBe('23 mei 1988');
    expect(formatCustomerBirthday(customer())).toBe('Niet ingevuld');
  });

  it('requires day and month together but allows an empty birthday', () => {
    expect(normalizeBirthdayInput({ day: null, month: null, year: null })).toEqual({ day: null, month: null, year: null });
    expect(normalizeBirthdayInput({ day: 7, month: 6, year: null })).toEqual({ day: 7, month: 6, year: null });
    expect(() => normalizeBirthdayInput({ day: 31, month: 2, year: null })).toThrow(/geldig/);
    expect(() => normalizeBirthdayInput({ day: 12, month: null, year: null })).toThrow(/dag en maand/);
  });

  it('returns reminders for birthdays today and within the next week', () => {
    const reminders = getBirthdayReminders([
      customer({ id: 'today', name: 'Vandaag', birthdayDay: 23, birthdayMonth: 5 }),
      customer({ id: 'week', name: 'Volgende week', birthdayDay: 30, birthdayMonth: 5 }),
      customer({ id: 'later', name: 'Later', birthdayDay: 31, birthdayMonth: 5 }),
    ], new Date(2026, 4, 23), 7);

    expect(reminders.map((reminder) => [reminder.customer.id, reminder.daysUntil, reminder.label])).toEqual([
      ['today', 0, 'Vandaag jarig'],
      ['week', 7, 'Over 7 dagen jarig'],
    ]);
  });
});