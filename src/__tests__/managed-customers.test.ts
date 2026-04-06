import { describe, expect, it } from 'vitest';
import {
  compareManagedCustomers,
  filterManagedCustomers,
  isCustomerManagedByAdmin,
  isManagedCustomer,
  type ManagedCustomerListItem,
} from '../business/lib/managed-customers';

function customer(overrides: Partial<ManagedCustomerListItem> = {}): ManagedCustomerListItem {
  return {
    id: overrides.id ?? 'cust-1',
    name: overrides.name ?? 'Maria Peeters',
    email: overrides.email ?? '',
    loginAlias: overrides.loginAlias ?? null,
    loginEmail: overrides.loginEmail ?? '',
    lastVisitAt: overrides.lastVisitAt ?? null,
    createdAt: overrides.createdAt ?? '2026-04-01T10:00:00.000Z',
    createdByAdminEmail: overrides.createdByAdminEmail ?? null,
  };
}

describe('managed customer helpers', () => {
  it('recognizes managed customers and ownership by admin email', () => {
    const managed = customer({ createdByAdminEmail: 'Owner@Cozy.be' });
    const regular = customer({ createdByAdminEmail: null });

    expect(isManagedCustomer(managed)).toBe(true);
    expect(isManagedCustomer(regular)).toBe(false);
    expect(isCustomerManagedByAdmin(managed, 'owner@cozy.be')).toBe(true);
    expect(isCustomerManagedByAdmin(managed, 'other@cozy.be')).toBe(false);
  });

  it('sorts managed customers by last visit, then createdAt, then name', () => {
    const first = customer({
      id: 'a',
      name: 'Anna',
      lastVisitAt: '2026-04-05T12:00:00.000Z',
      createdAt: '2026-04-04T08:00:00.000Z',
    });
    const second = customer({
      id: 'b',
      name: 'Bruno',
      lastVisitAt: '2026-04-03T12:00:00.000Z',
      createdAt: '2026-04-06T08:00:00.000Z',
    });
    const third = customer({
      id: 'c',
      name: 'Celine',
      lastVisitAt: '2026-04-03T12:00:00.000Z',
      createdAt: '2026-04-02T08:00:00.000Z',
    });

    expect([second, third, first].sort(compareManagedCustomers).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('filters only the current admins managed customers and matches account codes', () => {
    const customers = [
      customer({
        id: 'maria',
        name: 'Maria',
        loginAlias: 'maria-4821',
        loginEmail: 'maria-4821@accounts.cozy-moments.be',
        createdByAdminEmail: 'owner@cozy.be',
      }),
      customer({
        id: 'jan',
        name: 'Jan',
        email: 'jan@example.com',
        loginEmail: 'jan@example.com',
        createdByAdminEmail: 'owner@cozy.be',
      }),
      customer({
        id: 'els',
        name: 'Els',
        email: 'els@example.com',
        loginEmail: 'els@example.com',
        createdByAdminEmail: 'other@cozy.be',
      }),
    ];

    expect(filterManagedCustomers(customers, 'owner@cozy.be').map((item) => item.id)).toEqual(['jan', 'maria']);
    expect(filterManagedCustomers(customers, 'owner@cozy.be', '4821').map((item) => item.id)).toEqual(['maria']);
    expect(filterManagedCustomers(customers, 'owner@cozy.be', 'jan@example.com').map((item) => item.id)).toEqual(['jan']);
  });
});
