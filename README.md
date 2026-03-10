# Cozy Moments Loyalty

Digitale loyaliteitsapp voor Cozy Moments, opgesplitst in twee aparte webapps:

- customer app voor klanten op smartphone
- business app voor personeel op tablet of kassa

De actuele feature-set omvat:

- QR-scans voor consumpties
- QR-inwisselingen voor rewards
- 4 spaarkaarten: koffie, wijn, bier en frisdrank
- loyaliteitsniveaus: Bronze, Silver, Gold en Platinum
- automatische welkomstbonus
- klantenoverzicht met filters, export en omzetinschatting
- open-flessenbeheer met live promo-banner
- transactielogboek en manuele correcties
- PWA-installatie voor klant en beheer

## Stack

- React 19
- TypeScript
- Vite
- Tailwind 4
- Supabase
- Vercel

## Workspace-overzicht

- customer entry: [src/customer/App.tsx](src/customer/App.tsx)
- business entry: [src/business/App.tsx](src/business/App.tsx)
- loyalty store: [src/shared/store/LoyaltyContext.tsx](src/shared/store/LoyaltyContext.tsx)
- auth store klant: [src/shared/store/AuthContext.tsx](src/shared/store/AuthContext.tsx)
- auth store admin: [src/business/store/BusinessAuthContext.tsx](src/business/store/BusinessAuthContext.tsx)
- database schema: [supabase-schema.sql](supabase-schema.sql)
- handleiding bron: [HANDLEIDING-COZY-MOMENTS.md](HANDLEIDING-COZY-MOMENTS.md)
- handleiding pdf: [HANDLEIDING-COZY-MOMENTS.pdf](HANDLEIDING-COZY-MOMENTS.pdf)

## Lokale development

Installeer dependencies:

```bash
npm install
```

Start beide apps tegelijk:

```bash
npm run dev
```

Of start ze apart:

```bash
npm run dev:customer
npm run dev:business
```

Standaardpoorten:

- customer: https://localhost:3000
- business: https://localhost:3001

## Belangrijke nuance over lokale fallback

De authlaag heeft een beperkte fallback zonder Supabase, maar de loyalty-data zelf is Supabase-afhankelijk.  
Praktisch betekent dit:

- zonder Supabase kun je delen van de loginflow lokaal bekijken
- zonder Supabase krijg je geen werkende klanten-, scan-, reward- en historiekdata
- voor realistische lokale ontwikkeling is een werkende Supabase-configuratie nodig

## Verplichte omgevingsvariabelen

Maak een .env.local in de projectroot met minstens:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_QR_SECRET=generate-a-long-random-secret
VITE_ADMIN_EMAILS=admin@cozy-moments.be
```

Alleen voor lokale admin-fallback zonder echte Supabase-auth:

```env
VITE_ADMIN_PASSWORD=local-dev-password
```

## Supabase setup

1. Maak een nieuw Supabase-project aan.
2. Open SQL Editor.
3. Run volledig [supabase-schema.sql](supabase-schema.sql).
4. Voeg minstens 1 admin toe in de tabel admin_users:

```sql
INSERT INTO admin_users (email) VALUES ('admin@cozy-moments.be');
```

5. Maak dezelfde gebruiker ook aan in Supabase Auth.

## OAuth en wachtwoorden

De klanten-app ondersteunt in de actuele UI:

- Google login
- e-mail/wachtwoord login
- registratie
- wachtwoord vergeten
- reset via herstellink

Voor Google login moet je de Google provider in Supabase configureren en de juiste redirect-URL's instellen.

## Build en deploy

Build beide apps:

```bash
npm run build
```

Aparte buildtargets:

- customer output: dist/customer
- business output: dist/business

Aanbevolen deployment:

- 1 aparte Vercel-project voor customer
- 1 aparte Vercel-project voor business

## Supabase keepalive

Supabase kan op goedkopere plannen een project pauzeren na langere inactiviteit. Helemaal garanderen dat een project "nooit" slaapt kun je alleen met een plan zonder auto-pause, maar deze repo bevat nu wel een degelijke keepalive-opzet.

Wat er nu in de repo zit:

- een lichtgewicht ping-script: [scripts/keep-supabase-alive.mjs](scripts/keep-supabase-alive.mjs)
- een dagelijkse GitHub Action: [.github/workflows/supabase-keepalive.yml](.github/workflows/supabase-keepalive.yml)

De workflow doet elke dag een kleine GET naar Supabase REST, standaard:

```text
/rest/v1/site_settings?select=id&id=eq.default&limit=1
```

Dat endpoint is bewust gekozen omdat de tabel al in deze app bestaat en altijd een `default` rij hoort te hebben.

### Benodigde GitHub Secrets

Zet in je GitHub repository onder Settings → Secrets and variables → Actions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optioneel:

- `SUPABASE_KEEPALIVE_PATH`

Gebruik hier bij voorkeur de service-role key, niet de anon key. In het actuele schema mag `site_settings` enkel gelezen worden door `authenticated` users, en de workflow moet zonder interactieve login betrouwbaar kunnen draaien.

Belangrijk: de service-role key hoort alleen in GitHub Secrets of een serveromgeving, nooit in frontend-env vars zoals `VITE_*`.

### Handmatig testen

Lokaal kun je de ping ook handmatig draaien:

```bash
npm run supabase:keepalive
```

Daarvoor moeten minstens deze env vars aanwezig zijn:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Praktische nuance

Deze aanpak verlaagt de kans sterk dat Supabase in slaap valt door inactiviteit, maar het is geen harde SLA. Als je echt nul risico op auto-pause wilt, dan is een Supabase-plan zonder die beperking de enige waterdichte oplossing.

Aanbevolen buildcommands:

- customer: npm run build:customer
- business: npm run build:business

## Validatie

Typecheck:

```bash
npm run lint
```

Tests:

```bash
npm test
```

De huidige repo is in deze audit gevalideerd met:

- 52 geslaagde tests
- geslaagde TypeScript-check
- geslaagde production builds voor customer en business

## Handleiding en PDF

De handleidingbron staat in [HANDLEIDING-COZY-MOMENTS.md](HANDLEIDING-COZY-MOMENTS.md).  
De PDF moet inhoudelijk exact op die Markdown gebaseerd blijven.

Om de PDF opnieuw op te bouwen vanuit de actuele Markdown:

```bash
npm run docs:manual-pdf
```

Dat script:

- leest rechtstreeks de Markdown-handleiding in
- rendert die naar print-HTML
- exporteert daarna opnieuw naar [HANDLEIDING-COZY-MOMENTS.pdf](HANDLEIDING-COZY-MOMENTS.pdf)

## Security-opmerkingen

- Gebruik altijd een unieke, sterke waarde voor VITE_QR_SECRET.
- Laat VITE_ADMIN_EMAILS in productie nooit leeg.
- Deel de business-URL alleen intern.
- Houd admin_users en VITE_ADMIN_EMAILS synchroon.

## Belangrijkste functionele bestanden

- business dashboard: [src/business/pages/BusinessPage.tsx](src/business/pages/BusinessPage.tsx)
- klantdashboard: [src/customer/pages/CustomerPage.tsx](src/customer/pages/CustomerPage.tsx)
- scanner: [src/customer/pages/Scanner.tsx](src/customer/pages/Scanner.tsx)
- rewards: [src/customer/pages/RewardsPage.tsx](src/customer/pages/RewardsPage.tsx)
- QR signing: [src/shared/lib/qr-crypto.ts](src/shared/lib/qr-crypto.ts)
- loyalty tiers: [src/shared/lib/loyalty-tier.ts](src/shared/lib/loyalty-tier.ts)
- transaction helpers: [src/business/lib/transaction-history.ts](src/business/lib/transaction-history.ts)

## Documentatiebeleid

De actuele bron van waarheid voor productwerking is:

1. de code
2. [supabase-schema.sql](supabase-schema.sql)
3. [HANDLEIDING-COZY-MOMENTS.md](HANDLEIDING-COZY-MOMENTS.md)

Als de handleiding aangepast wordt, moet de PDF opnieuw gegenereerd worden zodat beide exact gelijk blijven.