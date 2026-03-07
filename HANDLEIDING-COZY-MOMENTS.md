
---

<div style="text-align: center; margin-top: 120px;">

# COZY MOMENTS

## Digitaal Loyaliteitssysteem

### Gebruikershandleiding

---

**Versie 1.0 — Maart 2026**

**Een product van WebAanZee**

www.webaanzee.be

</div>

<div style="page-break-after: always;"></div>

---

# Inhoudsopgave

1. [Wat is het Cozy Moments Loyaliteitssysteem?](#1-wat-is-het-cozy-moments-loyaliteitssysteem)
2. [Hoe werkt het? — Overzicht](#2-hoe-werkt-het--overzicht)
3. [Het Admin Paneel (voor de zaak)](#3-het-admin-paneel-voor-de-zaak)
   - 3.1 Inloggen
   - 3.2 Tab: Nieuwe QR
   - 3.3 Tab: Klanten
   - 3.4 Tab: Inwisselen
   - 3.5 Screensaver
   - 3.6 Uitloggen
4. [De Klanten App (voor de klant)](#4-de-klanten-app-voor-de-klant)
   - 4.1 Account aanmaken
   - 4.2 Dashboard
   - 4.3 QR Code scannen
   - 4.4 Beloningen bekijken
5. [Het Spaarsysteem — Spelregels](#5-het-spaarsysteem--spelregels)
6. [Klantstatistieken — Wat meten we?](#6-klantstatistieken--wat-meten-we)
7. [Data Exporteren (CSV & TXT)](#7-data-exporteren-csv--txt)
8. [Veelgestelde Vragen (FAQ)](#8-veelgestelde-vragen-faq)
9. [Technische Info & Support](#9-technische-info--support)

<div style="page-break-after: always;"></div>

---

# 1. Wat is het Cozy Moments Loyaliteitssysteem?

Het Cozy Moments Loyaliteitssysteem is een **digitale stempelkaart** die de traditionele papieren stempelkaart volledig vervangt. Uw klanten sparen stempels via hun smartphone en worden beloond met gratis consumpties.

### Voordelen voor uw zaak:

- **Geen papieren kaarten meer** — klanten verliezen hun kaart nooit
- **Volledig overzicht** van al uw klanten en hun consumptiegedrag
- **Inzicht in klantentrouw** — zie wie uw trouwste klanten zijn
- **Geschatte omzet per klant** — weet hoeveel elke klant waard is
- **Data export** — download klantenlijsten voor nieuwsbrieven of analyses
- **Professionele uitstraling** — een modern, digitaal systeem toont dat u meegaat met de tijd

### Vier spaarkaarten:

| Kaart | Kleur | Beschrijving |
|-------|-------|-------------|
| ☕ **Koffie** | Oker/bruin | Alle warme dranken |
| 🍷 **Wijn** | Bordeaux | Alle wijnen per glas |
| 🍺 **Bier** | Goud | Vat- en flesbier |
| 🧃 **Frisdrank** | Roze | Alle frisdranken |

<div style="page-break-after: always;"></div>

---

# 2. Hoe werkt het? — Overzicht

Het systeem bestaat uit twee onderdelen:

```
┌─────────────────────────┐         ┌─────────────────────────┐
│                         │         │                         │
│   ADMIN PANEEL          │   QR    │   KLANTEN APP           │
│   (tablet aan de kassa) │ ──────► │   (smartphone klant)    │
│                         │  scan   │                         │
│   • QR codes genereren  │         │   • QR code scannen     │
│   • Klanten beheren     │         │   • Stempels bekijken   │
│   • Beloningen inwisselen│        │   • Beloningen claimen  │
│                         │         │                         │
└─────────────────────────┘         └─────────────────────────┘
```

### De basisstappen:

1. **Klant bestelt** een consumptie aan de kassa
2. **U selecteert** op het admin paneel welke drankjes de klant heeft besteld
3. **U genereert** een QR code (1 druk op de knop)
4. **Klant scant** de QR code met de Cozy Moments app op zijn/haar smartphone
5. **Stempels worden automatisch** toegevoegd aan de juiste kaart
6. **Bij 10 stempels** → 1 gratis consumptie!

> **Belangrijk:** QR codes zijn beveiligd met een digitale handtekening en verlopen na 5 minuten. Klanten kunnen geen nep-QR codes aanmaken.

<div style="page-break-after: always;"></div>

---

# 3. Het Admin Paneel (voor de zaak)

Het admin paneel is bedoeld om op een **tablet** aan de kassa te draaien. Zet de tablet in een standaard en laat het systeem de hele dag open staan.

## 3.1 Inloggen

1. Open de browser op de tablet
2. Ga naar: **https://cozy-moments-admin.vercel.app/**
3. Vul uw inloggegevens in:

| | |
|---|---|
| **E-mail** | sixtine@cozy.com |
| **Wachtwoord** | sixtine2026! |

4. Tik op **"Inloggen"**

> Het wachtwoord is persoonlijk. Deel het niet met klanten.

#### Of scan direct:

<!-- QR_ADMIN -->

---

## 3.2 Tab: Nieuwe QR

Dit is het startscherm. Hier genereert u QR codes voor klanten die iets hebben besteld.

### Stap voor stap:

1. **Selecteer de consumpties** — Gebruik de **+** en **-** knoppen bij elk dranktype:
   - ☕ Koffie: voor elke koffie of warme drank
   - 🍷 Wijn: voor elk glas wijn
   - 🍺 Bier: voor elk biertje
   - 🧃 Frisdrank: voor elke frisdrank

2. **Tik op "Genereer QR Code"** — Er verschijnt een grote QR code op het scherm

3. **Laat de klant scannen** — De klant opent de Cozy Moments app en scant de QR code

4. **Wacht op bevestiging** — Zodra de klant scant, verschijnt er een groen vinkje ✅ met een geluidje, en het scherm reset automatisch

### Voorbeeld:
> Een klant bestelt 2 koffies en 1 biertje.
> → Tik 2x op **+** bij Koffie, 1x op **+** bij Bier → "Genereer QR Code"

### Goed om te weten:
- U kunt **meerdere drankjes tegelijk** in één QR code stoppen
- De QR code **verloopt na 5 minuten** (veiligheid)
- Na 60 seconden reset het scherm automatisch
- Als de klant niet scant, tik op **"Nieuwe Transactie"** om te resetten

---

## 3.3 Tab: Klanten

Hier ziet u **al uw klanten** en hun volledige statistieken.

### Dashboard Samenvatting (bovenaan)

Bovenaan de klantenpagina ziet u vier samenvattingskaarten:

| Kaart | Betekenis |
|-------|-----------|
| **Klanten** | Totaal aantal geregistreerde klanten |
| **Consumpties** | Totaal aantal verkochte consumpties (alle klanten samen) |
| **Actief deze maand** | Hoeveel klanten deze maand iets hebben geconsumeerd |
| **Geschatte omzet** | Totale geschatte omzet op basis van gemiddelde drankprijzen |

### Zoeken

Gebruik de **zoekbalk** om een klant te vinden op naam of e-mailadres.

### Klantdetail (tik op een klant om uit te klappen)

Per klant ziet u de volgende informatie:

#### Klant Inzichten
| Gegeven | Beschrijving |
|---------|-------------|
| **Favoriet** | Het dranktype dat de klant het meest bestelt |
| **Geschatte omzet** | Hoeveel deze klant naar schatting heeft uitgegeven |
| **Bezoeken** | Totaal aantal keren dat de klant een QR code heeft gescand |
| **Laatste bezoek** | Hoeveel dagen geleden de klant voor het laatst is geweest |
| **Gem. per bezoek** | Gemiddeld aantal consumpties per bezoek |

#### Totale Consumpties
Per dranktype het totaal aantal consumpties + het gemiddelde per maand.

#### Stempelkaart
De huidige stand van de stempelkaart (bijv. 7/10 koffie).

#### Volle kaarten
Hoeveel volle kaarten (= verdiende beloningen) deze klant nog kan inwisselen.

#### Ingewisseld
Hoeveel gratis consumpties de klant al heeft opgenomen.

### Export

Tik op de **"Export"** knop rechtsboven om alle klantendata te downloaden:
- **CSV-bestand** — voor Excel, Google Sheets of nieuwsbriefimport
- **TXT-bestand** — leesbaar tekstoverzicht om af te drukken

> De export bevat alle statistieken: stempels, bezoeken, geschatte omzet, favorieten, etc.

---

## 3.4 Tab: Inwisselen

Wanneer een klant een **gratis consumptie** wil opnemen:

1. Ga naar de tab **"Inwisselen"**
2. Tik op het dranktype dat de klant gratis krijgt (bijv. "Gratis Koffie")
3. Er verschijnt een QR code
4. **Laat de klant scannen** met de app
5. De beloning wordt automatisch afgetrokken van de klant

> **Let op:** de klant moet minstens 1 volle kaart (10 stempels) hebben voor dat dranktype. Het systeem controleert dit automatisch.

---

## 3.5 Screensaver

Na **60 seconden inactiviteit** verschijnt er automatisch een mooie screensaver met foto's. Dit beschermt het scherm en ziet er professioneel uit in de zaak.

**Aanraken** om de screensaver te stoppen en terug te keren naar het admin paneel.

---

## 3.6 Uitloggen

Tik op het **uitlog-icoontje** (⏻ rechts bovenaan) om uit te loggen. In de praktijk hoeft u alleen uit te loggen als u de tablet deelt met anderen.

<div style="page-break-after: always;"></div>

---

# 4. De Klanten App (voor de klant)

De klanten-app is een **website** die klanten openen op hun smartphone. Geen download uit de App Store nodig!

## 4.1 Account aanmaken

Klanten kunnen op twee manieren een account aanmaken:

1. **Google** — 1 tik om in te loggen met hun Google-account (snelst)
2. **E-mail + wachtwoord** — zelf een account aanmaken met naam, e-mailadres en wachtwoord

#### E-mail registratie stap voor stap

1. Klant tikt op **"Account aanmaken"**
2. Klant vult in: volledige naam, e-mailadres en een zelfgekozen wachtwoord
3. Het account is **direct actief** — er is géén bevestigingsmail nodig
4. Klant is meteen ingelogd en kan beginnen sparen

> **Wachtwoord vergeten?** Op de inlogpagina staat een **"Wachtwoord vergeten"**-knop. De klant vult zijn/haar e-mailadres in en ontvangt een link om een nieuw wachtwoord in te stellen.

## 4.2 Dashboard

Na het inloggen ziet de klant:
- **4 stempelkaarten** — visueel met gevulde bolletjes (☕🍷🍺🧃)
- **Motiverende teksten** — "Halverwege! Nog 5 stempels 🍻"
- **Beloningenbanner** — als er gratis consumpties beschikbaar zijn
- **Scan-knop** — om een QR code te scannen

## 4.3 QR Code scannen

1. Klant tikt op **"Scan QR Code"**
2. De camera opent (de klant moet toestemming geven)
3. Klant richt de camera op de QR code op de tablet
4. **Piep!** — stempels worden automatisch toegevoegd
5. Als er een beloning is verdiend, verschijnt een extra melding: "🎁 Beloning verdiend!"

## 4.4 Beloningen bekijken

Op de pagina **"Mijn Beloningen"** ziet de klant:
- **Beschikbare beloningen** — per type (bijv. "1x Gratis Koffie")
- **Eerder ingewisseld** — hoeveel gratis consumpties al opgenomen

<div style="page-break-after: always;"></div>

---

# 5. Het Spaarsysteem — Spelregels

### Basis: 10 stempels = 1 gratis consumptie

| Regel | Beschrijving |
|-------|-------------|
| **Sparen** | Elke consumptie = 1 stempel op de bijbehorende kaart |
| **Beloning** | 10 stempels op één kaart = 1 gratis consumptie van dat type |
| **Waarde** | De gratis consumptie is max. **€3,50 tot €5** waard (afhankelijk van het dranktype) |
| **Premium** | Duurdere drank? De volle kaart geeft **€3,50 tot €5 korting** (afhankelijk van het type) |
| **Meerdere kaarten** | Elke kaart spaart apart (koffie ≠ wijn) |
| **Overdracht** | Stempels boven de 10 worden meegenomen naar de volgende kaart |
| **Geen vervaldatum** | Stempels vervallen niet |
| **Persoonlijk** | Stempels zijn gekoppeld aan het account van de klant |

### Voorbeeld:
> Lisa heeft 8 koffie-stempels. Ze bestelt 3 koffies.
> → 8 + 3 = 11 → **1 gratis koffie verdiend** + 1 stempel op de nieuwe kaart.

### Inwisselen:
> Lisa komt de volgende dag en wil haar gratis koffie. De bediening gaat naar "Inwisselen" → "Gratis Koffie" → Lisa scant de QR → klaar!

<div style="page-break-after: always;"></div>

---

# 6. Klantstatistieken — Wat meten we?

Het systeem houdt de volgende gegevens bij per klant:

### Basisgegevens
| Gegeven | Beschrijving |
|---------|-------------|
| Naam | Volledige naam van de klant |
| E-mail | E-mailadres (voor eventuele nieuwsbrief) |
| Klant sinds | Datum van registratie |

### Stempelkaarten
| Gegeven | Beschrijving |
|---------|-------------|
| Huidige stempels | Per dranktype: 0-9 stempels |
| Volle kaarten | Verdiende maar nog niet ingewisselde beloningen |
| Ingewisseld | Aantal gratis consumpties reeds opgenomen |

### Consumptiegedrag
| Gegeven | Beschrijving |
|---------|-------------|
| Totaal per type | Koffie, wijn, bier, frisdrank — alles bij elkaar |
| Gemiddelde per maand | Per dranktype: hoeveel per maand gemiddeld |
| Totaal alle consumpties | Eén getal: alles opgeteld |
| Favoriet drankje | Het meest bestelde type (automatisch berekend) |

### Bezoekersgedrag
| Gegeven | Beschrijving |
|---------|-------------|
| Totaal bezoeken | Aantal keren dat de klant een QR code heeft gescand |
| Laatste bezoek | Datum + "X dagen geleden" |
| Gem. per bezoek | Gemiddeld aantal consumpties per scan-sessie |
| Actief deze maand | Ja/nee indicator in het dashboard |

### Financieel (schatting)
| Gegeven | Beschrijving |
|---------|-------------|
| Geschatte omzet per klant | Op basis van gemiddelde prijzen (koffie €3, wijn €5, bier €4, frisdrank €3) |
| Geschatte totale omzet | Alle klanten samen — zichtbaar in het dashboard |

> **Opmerking:** De geschatte omzet is een benadering op basis van gemiddelde drankprijzen. Het geeft een goede indicatie maar is geen exacte boekhouding.

<div style="page-break-after: always;"></div>

---

# 7. Data Exporteren (CSV & TXT)

### CSV Export (voor Excel / Google Sheets / Nieuwsbrief)

Het CSV-bestand bevat per klant:
- Naam, e-mail
- Stempels per type
- Volle kaarten per type
- Ingewisseld per type
- Totaal consumpties per type
- Gemiddelde per maand per type
- Totaal bezoeken
- Laatste bezoek
- Geschatte omzet
- Klant sinds

> **Tip voor Excel:** Het bestand gebruikt puntkomma's (;) als scheidingsteken, zodat Belgische/Nederlandse Excel het direct goed opent.

### TXT Export (leesbaar overzicht)

Een netjes opgemaakt tekstbestand dat u kunt afdrukken of doorsturen:

```
════════════════════════════════════════════════
         COZY MOMENTS — KLANTENEXPORT
         05/03/2026 om 20:30
════════════════════════════════════════════════

Totaal aantal klanten: 42

────────────────────────────────────────
1. Jan Janssens
   E-mail:        jan@email.com
   Klant sinds:   15/01/2026
   Laatste bezoek: 04/03/2026
   Totaal bezoeken: 18
   Favoriet:      Koffie
   Geschatte omzet: €87.00
   Totaal:        Koffie: 23  |  Wijn: 5  |  Bier: 8  |  Frisdrank: 2
   ...
```

<div style="page-break-after: always;"></div>

---

# 8. Veelgestelde Vragen (FAQ)

### Voor de zaak

**V: Wat als een klant de QR code niet kan scannen?**
**A:** Controleer of de klant ingelogd is in de app. De klant moet op "Scan QR Code" tikken en de camera toestaan. Bij problemen: herlaad de pagina.

**V: Kan een klant vals spelen met nepQR codes?**
**A:** Nee. Elke QR code is digitaal ondertekend met een geheime sleutel en verloopt na 5 minuten. Alleen QR codes van uw admin paneel werken.

**V: Wat als ik per ongeluk de verkeerde consumpties selecteer?**
**A:** Als de klant de QR code nog niet heeft gescand, tik op **"Nieuwe Transactie"** om te resetten en opnieuw te beginnen. Is de QR code al gescand? Geen zorgen — u kunt dit bij een volgend bezoek gewoon compenseren (bv. één stempel minder geven), of het corrigeren via het admin-paneel (correctiefunctie binnenkort beschikbaar).

**V: Kan ik meerdere tablets gebruiken?**
**A:** Ja, u kunt op meerdere apparaten tegelijk inloggen met hetzelfde admin-account.

**V: Hoe voeg ik een tweede admin toe?**
**A:** Neem contact op met WebAanZee. We voegen het e-mailadres toe aan de beheerderslijst.

**V: Wat als het internet uitvalt?**
**A:** Het systeem heeft internet nodig om te werken. Zonder internet kunt u geen QR codes genereren en kunnen klanten niet scannen. Zorg voor een stabiele WiFi-verbinding.

**V: Moet de tablet altijd aan staan?**
**A:** Het is het handigst om de tablet de hele dag aan te laten. Na 60 seconden verschijnt automatisch de screensaver om het scherm te beschermen.

---

### Voor de klant

**V: Moet ik een app downloaden?**
**A:** Nee! Het is een website. Open de link in je browser en sla hem op als snelkoppeling op je startscherm.

**V: Ik ben mijn wachtwoord vergeten.**
**A:** Op het loginscherm, tik op "Wachtwoord vergeten". Je ontvangt een e-mail met een link om je wachtwoord te resetten.

**V: Mijn camera werkt niet bij het scannen.**
**A:** Controleer of je de camera-toestemming hebt gegeven. De app toont stap-voor-stap instructies voor jouw browser (Safari, Chrome, Samsung, etc.).

**V: Vervallen mijn stempels?**
**A:** Nee, stempels vervallen niet. Je kunt rustig op je eigen tempo sparen.

**V: Kan ik mijn beloningen meteen inwisselen?**
**A:** Ja! Zodra je 10 stempels hebt, verschijnt de beloning in de app. Vraag aan de kassa om een inwisselQR te tonen en scan die.

<div style="page-break-after: always;"></div>

---

# 9. Technische Info & Support

### Systeem

| Onderdeel | Technologie |
|-----------|------------|
| Klanten-app | Webapplicatie (PWA) — werkt op iPhone, Android, desktop |
| Admin paneel | Webapplicatie — optimaal op tablet (iPad, Android tablet) |
| Database | Supabase (PostgreSQL) — beveiligd in de cloud |
| Beveiliging | HMAC-SHA256 ondertekening, Row Level Security, HTTPS |
| Hosting | Vercel — snel, betrouwbaar, schaalbaar |

### Aanbevolen hardware

- **Tablet** voor admin: iPad (9e generatie of nieuwer) of Samsung Galaxy Tab A
- **Tabletstandaard**: voor op de toog
- **Stabiele WiFi**: vereist voor zowel tablet als klant-telefoons

### URLs

| Functie | Adres |
|---------|-------|
| Klanten-app | https://cozy-moments-loyalty.vercel.app/dashboard |
| Admin paneel | https://cozy-moments-admin.vercel.app/ |

### QR codes — direct scannen

Scan de QR codes hieronder om de apps te openen op uw smartphone of iPad:

<!-- QR_BOTH -->

### Contact & Support

Bij vragen, problemen of aanpassingen:

**WebAanZee**
- Website: www.webaanzee.be
- E-mail: kevin@webaanzee.be
- Gsm: 0494 81 67 14

---

<div style="text-align: center; margin-top: 60px; padding: 40px; border-top: 2px solid #e8dcc8;">

**Cozy Moments Loyaliteitssysteem**

*Een product van WebAanZee*

*Versie 1.0 — Maart 2026*

*Alle rechten voorbehouden.*

</div>
