import { getCustomerContactLabel } from '../../shared/lib/customer-accounts';
import type { Customer } from '../../shared/store/LoyaltyContext';

export type ManagedCustomerListItem = Pick<
  Customer,
  'id' | 'name' | 'email' | 'loginAlias' | 'loginEmail' | 'lastVisitAt' | 'createdAt' | 'createdByAdminEmail'
>;

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function getSortableTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function isManagedCustomer(customer: Pick<ManagedCustomerListItem, 'createdByAdminEmail'>) {
  return normalizeEmail(customer.createdByAdminEmail).length > 0;
}

export function isCustomerManagedByAdmin(
  customer: Pick<ManagedCustomerListItem, 'createdByAdminEmail'>,
  adminEmail: string | null | undefined,
) {
  const customerAdminEmail = normalizeEmail(customer.createdByAdminEmail);
  const normalizedAdminEmail = normalizeEmail(adminEmail);

  return customerAdminEmail.length > 0 && customerAdminEmail === normalizedAdminEmail;
}

export function compareManagedCustomers<T extends ManagedCustomerListItem>(left: T, right: T) {
  const visitDelta = getSortableTimestamp(right.lastVisitAt) - getSortableTimestamp(left.lastVisitAt);
  if (visitDelta !== 0) {
    return visitDelta;
  }

  const createdAtDelta = getSortableTimestamp(right.createdAt) - getSortableTimestamp(left.createdAt);
  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return left.name.localeCompare(right.name, 'nl-BE');
}

export function matchesManagedCustomerSearch<T extends ManagedCustomerListItem>(customer: T, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystacks = [
    customer.name,
    getCustomerContactLabel(customer.email, customer.loginAlias, customer.loginEmail),
    customer.loginAlias ?? '',
    customer.loginEmail ?? '',
  ];

  return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function filterManagedCustomers<T extends ManagedCustomerListItem>(
  customers: T[],
  adminEmail: string | null | undefined,
  query = '',
) {
  return customers
    .filter(customer => isCustomerManagedByAdmin(customer, adminEmail))
    .filter(customer => matchesManagedCustomerSearch(customer, query))
    .sort(compareManagedCustomers);
}
