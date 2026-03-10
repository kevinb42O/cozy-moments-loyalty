const rawUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const rawKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

const keepalivePath =
  process.env.SUPABASE_KEEPALIVE_PATH ||
  '/rest/v1/site_settings?select=id&id=eq.default&limit=1';

if (!rawUrl) {
  console.error('Missing SUPABASE_URL or VITE_SUPABASE_URL.');
  process.exit(1);
}

if (!rawKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const baseUrl = rawUrl.replace(/\/$/, '');
const requestUrl = new URL(
  keepalivePath.startsWith('/') ? keepalivePath : `/${keepalivePath}`,
  `${baseUrl}/`,
);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);

try {
  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      apikey: rawKey,
      Authorization: `Bearer ${rawKey}`,
      Accept: 'application/json',
      'Cache-Control': 'no-store',
    },
    signal: controller.signal,
  });

  clearTimeout(timeout);

  const body = await response.text();

  if (!response.ok) {
    console.error(`Supabase keepalive failed: ${response.status} ${response.statusText}`);
    if (body) {
      console.error(body);
    }
    process.exit(1);
  }

  console.log(`Supabase keepalive OK at ${new Date().toISOString()}`);
  console.log(`Endpoint: ${requestUrl.pathname}${requestUrl.search}`);
  console.log(`Status: ${response.status}`);
  if (body) {
    console.log(`Response: ${body}`);
  }
} catch (error) {
  clearTimeout(timeout);
  console.error('Supabase keepalive request crashed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}