import { TEMP_CUSTOMER_PASSWORD } from '../../shared/lib/customer-accounts';
import { callAdminEdgeFunction } from './admin-edge';

export interface CreateCustomerAccountInput {
  name: string;
  email?: string;
  birthdayDay?: number | null;
  birthdayMonth?: number | null;
  birthdayYear?: number | null;
}

export interface CreateCustomerAccountResult {
  customerId: string;
  name: string;
  contactEmail: string | null;
  loginEmail: string;
  loginAlias: string | null;
  loginIdentifier: string;
  temporaryPassword: string;
  mustResetPassword: boolean;
  createdByAdminEmail: string | null;
  birthdayDay: number | null;
  birthdayMonth: number | null;
  birthdayYear: number | null;
  partnerFirstName: string | null;
  partnerBirthdayDay: number | null;
  partnerBirthdayMonth: number | null;
  partnerBirthdayYear: number | null;
}

export async function createCustomerAccount(input: CreateCustomerAccountInput) {
  const payload = {
    name: input.name.trim(),
    email: input.email?.trim() ? input.email.trim().toLowerCase() : null,
    birthdayDay: input.birthdayDay ?? null,
    birthdayMonth: input.birthdayMonth ?? null,
    birthdayYear: input.birthdayYear ?? null,
  };

  const result = await callAdminEdgeFunction<Partial<CreateCustomerAccountResult> | null>('create-customer-account', payload);

  if (!result?.customerId || !result?.loginEmail) {
    throw new Error('De server stuurde geen geldig account terug.');
  }

  return {
    customerId: result.customerId,
    name: result.name ?? payload.name,
    contactEmail: result.contactEmail ?? payload.email ?? null,
    loginEmail: result.loginEmail,
    loginAlias: result.loginAlias ?? null,
    loginIdentifier: result.loginIdentifier ?? result.loginAlias ?? result.loginEmail,
    temporaryPassword: result.temporaryPassword ?? TEMP_CUSTOMER_PASSWORD,
    mustResetPassword: result.mustResetPassword ?? true,
    createdByAdminEmail: result.createdByAdminEmail ?? null,
    birthdayDay: result.birthdayDay ?? payload.birthdayDay,
    birthdayMonth: result.birthdayMonth ?? payload.birthdayMonth,
    birthdayYear: result.birthdayYear ?? payload.birthdayYear,
    partnerFirstName: result.partnerFirstName ?? null,
    partnerBirthdayDay: result.partnerBirthdayDay ?? null,
    partnerBirthdayMonth: result.partnerBirthdayMonth ?? null,
    partnerBirthdayYear: result.partnerBirthdayYear ?? null,
  } satisfies CreateCustomerAccountResult;
}
