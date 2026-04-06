import { supabase, SUPABASE_ANON_KEY, SUPABASE_READY, SUPABASE_URL } from '../../shared/lib/supabase';

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

export async function callAdminEdgeFunction<TResponse>(functionName: string, payload?: unknown) {
  if (!SUPABASE_READY || !supabase) {
    throw new Error('Supabase is niet geconfigureerd.');
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuratie ontbreekt in deze build.');
  }

  const requestWithToken = (accessToken: string) => fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: payload === undefined ? '{}' : JSON.stringify(payload),
  });

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

  let response = await requestWithToken(session.access_token);

  if (response.status === 401) {
    const firstAttemptMessage = await parseResponseBody(response.clone());

    if (firstAttemptMessage?.toLowerCase().includes('invalid jwt')) {
      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        throw new Error('Je adminsessie is verlopen. Log opnieuw in.');
      }

      const refreshedToken = refreshedData.session?.access_token;

      if (!refreshedToken) {
        throw new Error('Je adminsessie is verlopen. Log opnieuw in.');
      }

      response = await requestWithToken(refreshedToken);
    }
  }

  if (!response.ok) {
    const message = await parseResponseBody(response);
    throw new Error(message ? `${message} (status ${response.status})` : `Actie mislukt (status ${response.status}).`);
  }

  const text = await response.text();
  if (!text) {
    return null as TResponse;
  }

  try {
    return JSON.parse(text) as TResponse;
  } catch {
    throw new Error('De server stuurde geen geldige JSON terug.');
  }
}
