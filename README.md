# Cozy Moments — Digital Loyalty App

Two-sided SaaS loyalty app:
- **Customer app** — customers collect stamps by scanning QR codes
- **Admin panel** — password-protected, hidden from customers

---

## Run locally (works instantly, no Supabase needed)

```bash
npm install
npm run dev:customer   # https://localhost:3000
npm run dev:business   # https://localhost:3001
```

**Admin login:** `sixtine2026` / `sixtine2026`

> Without Supabase keys in `.env.local`, the app uses localStorage automatically.

---

## Step 1 — Supabase setup (5 min)

1. Go to **https://supabase.com** → New project → name it `cozy-moments`
2. Wait ~2 min for startup
3. **SQL Editor** → New Query → paste `supabase-schema.sql` → Run
4. **Settings → API** → copy Project URL + anon key
5. Create `.env.local` in project root:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

6. Restart dev server — data now lives in Supabase

---

## Step 2 — Enable Google OAuth in Supabase

1. **console.cloud.google.com** → New project → OAuth 2.0 credentials
2. Authorized redirect URI: `https://<supabase-url>/auth/v1/callback`
3. Supabase → **Authentication → Providers → Google** → paste Client ID + Secret → Save

---

## Step 3 — Deploy to Vercel (2 separate projects)

### Customer app
- Build command: `npm run build:customer`
- Output directory: `dist/customer`
- Env vars: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

### Admin panel (secret URL — share only with admin)
- Build command: `npm run build:business`
- Output directory: `dist/business`
- Same env vars

### Supabase redirect URLs
In Supabase → **Auth → URL Configuration**:
```
Site URL: https://your-customer-app.vercel.app
Redirect URLs: https://your-customer-app.vercel.app/**
```

---

## Admin credentials

| Login | Password |
|---|---|
| `sixtine2026` | `sixtine2026` |

Change in: `src/business/store/BusinessAuthContext.tsx` lines 7–8

---

## How stamps flow

```
Sixtine (admin panel)              Customer
──────────────────────────────────────────────────
Selects: 2 coffees, 1 wine
Generates QR code ────────────▶ Customer scans QR
                                 +2 coffee, +1 wine stamps saved
10 stamps collected ──────────▶ Free drink reward unlocked
Sixtine generates redeem QR ──▶ Customer scans → reward used
```

---

## Checklist

- [x] Admin login (sixtine2026 / sixtine2026)
- [x] Customer app with QR scanner
- [x] Supabase-backed data (auto-fallback to localStorage)
- [x] TypeScript: 0 errors
- [x] Pushed to GitHub
- [ ] YOU: Create Supabase project + run SQL schema
- [ ] YOU: Add .env.local with Supabase keys
- [ ] YOU: Enable Google OAuth in Supabase
- [ ] YOU: Deploy 2 Vercel projects
