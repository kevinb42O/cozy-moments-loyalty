import { callAdminEdgeFunction } from './admin-edge';

export interface AdminAccount {
  email: string;
  displayName: string | null;
  authUserId: string | null;
  createdAt: string;
  createdByAdminEmail: string | null;
  isActive: boolean;
}

export interface CreateAdminAccountInput {
  displayName: string;
  email: string;
}

export interface CreateAdminAccountResult extends AdminAccount {
  temporaryPassword: string;
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function timestamp(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAdminAccount(record: Partial<AdminAccount> | null | undefined) {
  const email = normalizeEmail(record?.email);

  if (!email) {
    throw new Error('De server stuurde een admin zonder e-mailadres terug.');
  }

  return {
    email,
    displayName: typeof record?.displayName === 'string' && record.displayName.trim()
      ? record.displayName.trim()
      : null,
    authUserId: typeof record?.authUserId === 'string' && record.authUserId.trim()
      ? record.authUserId.trim()
      : null,
    createdAt: typeof record?.createdAt === 'string' && record.createdAt.trim()
      ? record.createdAt
      : new Date(0).toISOString(),
    createdByAdminEmail: normalizeEmail(record?.createdByAdminEmail) || null,
    isActive: record?.isActive !== false,
  } satisfies AdminAccount;
}

export function compareAdminAccounts(a: AdminAccount, b: AdminAccount) {
  const createdDiff = timestamp(b.createdAt) - timestamp(a.createdAt);
  if (createdDiff !== 0) {
    return createdDiff;
  }

  const nameA = (a.displayName || a.email).toLocaleLowerCase('nl-BE');
  const nameB = (b.displayName || b.email).toLocaleLowerCase('nl-BE');
  if (nameA !== nameB) {
    return nameA.localeCompare(nameB, 'nl-BE');
  }

  return a.email.localeCompare(b.email, 'nl-BE');
}

export function matchesAdminQuery(admin: AdminAccount, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [admin.displayName, admin.email, admin.createdByAdminEmail]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function filterAdminAccounts(accounts: AdminAccount[], query = '') {
  return [...accounts]
    .filter((account) => matchesAdminQuery(account, query))
    .sort(compareAdminAccounts);
}

export async function listAdminAccounts() {
  const result = await callAdminEdgeFunction<{ admins?: Partial<AdminAccount>[] } | Partial<AdminAccount>[] | null>('list-admin-accounts');
  const records = Array.isArray(result) ? result : result?.admins ?? [];
  return records.map(normalizeAdminAccount).sort(compareAdminAccounts);
}

export async function createAdminAccount(input: CreateAdminAccountInput) {
  const payload = {
    displayName: input.displayName.trim(),
    email: normalizeEmail(input.email),
  };

  const result = await callAdminEdgeFunction<Partial<CreateAdminAccountResult> | null>('create-admin-account', payload);

  if (!result?.email || !result?.temporaryPassword) {
    throw new Error('De server stuurde geen geldig adminaccount terug.');
  }

  return {
    ...normalizeAdminAccount(result),
    temporaryPassword: result.temporaryPassword,
  } satisfies CreateAdminAccountResult;
}
