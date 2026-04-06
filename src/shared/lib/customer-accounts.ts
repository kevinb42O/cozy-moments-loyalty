export const TEMP_CUSTOMER_PASSWORD = 'cozymoments';
export const MANAGED_CUSTOMER_EMAIL_DOMAIN = 'accounts.cozymoments.local';
const FALLBACK_MANAGED_ALIAS = 'cozy-klant';

export function buildManagedLoginAlias(value: string) {
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || FALLBACK_MANAGED_ALIAS;
}

export function buildManagedLoginEmail(alias: string) {
  return `${buildManagedLoginAlias(alias)}@${MANAGED_CUSTOMER_EMAIL_DOMAIN}`;
}

export function isManagedLoginEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.endsWith(`@${MANAGED_CUSTOMER_EMAIL_DOMAIN}`);
}

export function parseManagedLoginAlias(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? '';
  const suffix = `@${MANAGED_CUSTOMER_EMAIL_DOMAIN}`;

  if (!normalized.endsWith(suffix)) {
    return null;
  }

  const alias = normalized.slice(0, -suffix.length).trim();
  return alias || null;
}

export function getCustomerLoginAlias(loginAlias: string | null | undefined, loginEmail: string | null | undefined) {
  const explicitAlias = loginAlias?.trim().toLowerCase() ?? '';

  if (explicitAlias) {
    return explicitAlias;
  }

  return parseManagedLoginAlias(loginEmail);
}

export function getCustomerLoginIdentifier(loginAlias: string | null | undefined, loginEmail: string | null | undefined) {
  const alias = getCustomerLoginAlias(loginAlias, loginEmail);

  if (alias) {
    return alias;
  }

  return loginEmail?.trim().toLowerCase() ?? '';
}

export function getCustomerContactLabel(
  contactEmail: string | null | undefined,
  loginAlias: string | null | undefined,
  loginEmail: string | null | undefined,
) {
  const normalizedContactEmail = contactEmail?.trim() ?? '';

  if (normalizedContactEmail) {
    return normalizedContactEmail;
  }

  const alias = getCustomerLoginAlias(loginAlias, loginEmail);

  if (alias) {
    return `Accountcode: ${alias}`;
  }

  const normalizedLoginEmail = loginEmail?.trim() ?? '';
  return normalizedLoginEmail || 'Geen e-mailadres beschikbaar';
}

export function normalizeCustomerLoginInput(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return '';
  }

  if (normalized.includes('@')) {
    return normalized;
  }

  return buildManagedLoginEmail(normalized);
}
