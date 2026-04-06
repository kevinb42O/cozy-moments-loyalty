import { describe, expect, it } from 'vitest';
import {
  buildManagedLoginAlias,
  buildManagedLoginEmail,
  getCustomerContactLabel,
  getCustomerLoginIdentifier,
  normalizeCustomerLoginInput,
  parseManagedLoginAlias,
} from '../shared/lib/customer-accounts';

describe('customer account helpers', () => {
  it('normalizes names to ascii account codes', () => {
    expect(buildManagedLoginAlias('  José Van den Berg  ')).toBe('jose-van-den-berg');
    expect(buildManagedLoginAlias('@@@')).toBe('cozy-klant');
  });

  it('converts account codes to managed login emails', () => {
    expect(buildManagedLoginEmail('Maria Peeters 4821')).toBe('maria-peeters-4821@accounts.cozy-moments.be');
    expect(normalizeCustomerLoginInput('maria-peeters-4821')).toBe('maria-peeters-4821@accounts.cozy-moments.be');
    expect(normalizeCustomerLoginInput('MIA@EXAMPLE.COM')).toBe('mia@example.com');
  });

  it('recovers aliases and contact labels for managed accounts', () => {
    const loginEmail = 'maria-peeters-4821@accounts.cozymoments.local';

    expect(parseManagedLoginAlias(loginEmail)).toBe('maria-peeters-4821');
    expect(getCustomerLoginIdentifier(null, loginEmail)).toBe('maria-peeters-4821');
    expect(getCustomerContactLabel('', null, loginEmail)).toBe('Accountcode: maria-peeters-4821');
  });

  it('prefers real contact email when available', () => {
    expect(getCustomerContactLabel('maria@example.com', 'maria-peeters-4821', 'maria-peeters-4821@accounts.cozymoments.local')).toBe('maria@example.com');
  });
});
