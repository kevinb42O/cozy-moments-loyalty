import { supabase, SUPABASE_ANON_KEY, SUPABASE_READY, SUPABASE_URL } from '../../shared/lib/supabase';
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

async function parseResponseBody(response: Response) {
  try {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      const data = JSON.parse(text) as { error?: unknown; message?: unknown };
      if (typeof data.error === 'string') {
        return data.error;
      }
      if (typeof data.message === 'string') {
        return data.message;
      }
    } catch {
      // leave as plain text
    }

    return text;
  } catch {
    return null;
  }
}

export async function createCustomerAccount(input: CreateCustomerAccountInput) {
  if (!SUPABASE_READY || !supabase) {
    throw new Error('Supabase is niet geconfigureerd.');
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuratie ontbreekt in deze build.');
  }

  const payload = {
    name: input.name.trim(),
    email: input.email?.trim() ? input.email.trim().toLowerCase() : null,
  };

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || 'Kon je adminsessie niet controleren.');
  }

  if (!session?.access_token) {
    throw new Error('Je adminsessie is verlopen. Log opnieuw in.');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-customer-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await parseResponseBody(response);
    throw new Error(message ? `${message} (status ${response.status})` : `Account aanmaken mislukt (status ${response.status}).`);
  }

  const result = await response.json() as Partial<CreateCustomerAccountResult> | null;

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
