import { describe, expect, it } from 'vitest';
import {
  compareAdminAccounts,
  filterAdminAccounts,
  matchesAdminQuery,
  type AdminAccount,
} from '../business/lib/admin-accounts';

function admin(overrides: Partial<AdminAccount> = {}): AdminAccount {
  return {
    email: overrides.email ?? 'admin@cozy-moments.be',
    displayName: overrides.displayName ?? 'Cozy Admin',
    authUserId: overrides.authUserId ?? 'user-1',
    createdAt: overrides.createdAt ?? '2026-04-06T10:00:00.000Z',
    createdByAdminEmail: overrides.createdByAdminEmail ?? 'owner@cozy-moments.be',
    isActive: overrides.isActive ?? true,
  };
}

describe('admin account helpers', () => {
  it('sorts admins by createdAt descending and then by display name', () => {
    const first = admin({ email: 'bruno@cozy.be', displayName: 'Bruno', createdAt: '2026-04-06T11:00:00.000Z' });
    const second = admin({ email: 'anna@cozy.be', displayName: 'Anna', createdAt: '2026-04-06T11:00:00.000Z' });
    const third = admin({ email: 'els@cozy.be', displayName: 'Els', createdAt: '2026-04-05T09:00:00.000Z' });

    expect([first, third, second].sort(compareAdminAccounts).map((item) => item.email)).toEqual([
      'anna@cozy.be',
      'bruno@cozy.be',
      'els@cozy.be',
    ]);
  });

  it('matches search on display name, email and creator email', () => {
    const sarah = admin({
      email: 'sarah@cozy.be',
      displayName: 'Sarah Vermeulen',
      createdByAdminEmail: 'owner@cozy-moments.be',
    });

    expect(matchesAdminQuery(sarah, 'sarah')).toBe(true);
    expect(matchesAdminQuery(sarah, 'owner@cozy')).toBe(true);
    expect(matchesAdminQuery(sarah, 'other@cozy.be')).toBe(false);
  });

  it('filters and sorts the admin overview consistently', () => {
    const admins = [
      admin({
        email: 'jef@cozy.be',
        displayName: 'Jef',
        createdAt: '2026-04-03T08:00:00.000Z',
      }),
      admin({
        email: 'sarah@cozy.be',
        displayName: 'Sarah',
        createdAt: '2026-04-06T09:00:00.000Z',
        createdByAdminEmail: 'jef@cozy.be',
      }),
      admin({
        email: 'marthe@cozy.be',
        displayName: 'Marthe',
        createdAt: '2026-04-04T09:00:00.000Z',
      }),
    ];

    expect(filterAdminAccounts(admins, 'jef').map((item) => item.email)).toEqual([
      'sarah@cozy.be',
      'jef@cozy.be',
    ]);
  });
});
