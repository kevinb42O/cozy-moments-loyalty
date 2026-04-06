import { supabase, SUPABASE_READY } from '../../shared/lib/supabase';
import { TEMP_CUSTOMER_PASSWORD } from '../../shared/lib/customer-accounts';

export interface CreateCustomerAccountInput {
  name: string;
  email?: string;
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
}

async function resolveFunctionErrorMessage(error: any) {
  const fallbackMessage = error?.message || 'Account aanmaken mislukt.';

  if (!error?.context || typeof error.context.json !== 'function') {
    return fallbackMessage;
  }

  try {
    const data = await error.context.json();
    return typeof data?.error === 'string' ? data.error : fallbackMessage;
  } catch {
    try {
      const text = await error.context.text();
      return text || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }
}

export async function createCustomerAccount(input: CreateCustomerAccountInput) {
  if (!SUPABASE_READY || !supabase) {
    throw new Error('Supabase is niet geconfigureerd.');
  }

  const payload = {
    name: input.name.trim(),
    email: input.email?.trim() ? input.email.trim().toLowerCase() : null,
  };

  const { data, error } = await supabase.functions.invoke('create-customer-account', {
    body: payload,
  });

  if (error) {
    throw new Error(await resolveFunctionErrorMessage(error));
  }

  const result = data as Partial<CreateCustomerAccountResult> | null;

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
  } satisfies CreateCustomerAccountResult;
}
