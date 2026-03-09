# COZY MOMENTS

## Digitaal Loyaliteitssysteem

### Gebruikershandleiding

Versie 2.0  
Bijgewerkt op 9 maart 2026  
Gebaseerd op de actuele codebasis, databasefuncties en build van dit project.

---

# Inhoud

1. Wat dit systeem exact doet
2. Onderdelen van het platform
3. Het beheerderspaneel
4. De klanten-app
5. Spaarregels en loyaliteitsniveaus
6. Open flessen en live promo's
7. Historiek, correcties en audittrail
8. Exporten en klantinzichten
9. Beveiliging, data en beheer
10. PWA en installatie op toestel
11. Praktische FAQ
12. Technische bijlage voor beheer

---

# 1. Wat dit systeem exact doet

Het Cozy Moments Loyaliteitssysteem is een digitale spaarkaart met twee aparte webapps:

- een klanten-app voor smartphonegebruik
- een beheerderspaneel voor tablet of kassa

Klanten sparen stempels via QR-codes. Het systeem verwerkt vier dranktypes:

- koffie
- wijn
- bier
- frisdrank

Per 10 stempels op 1 kaart krijgt de klant 1 gratis consumptie van datzelfde type.

Daarnaast kent het systeem ook een algemeen loyaliteitsniveau toe:

- Bronze
- Silver
- Gold
- VIP

Het platform doet vandaag meer dan alleen stempels bijhouden. De actuele build ondersteunt ook:

- automatische welkomstbonus op de eerste geldige scan
- live promo-berichten voor klanten
- open-flessenopvolging met timers
- transactielogboek voor scans, inwisselingen en manuele correcties
- manuele correcties met reden en medewerker
- klantfilters op level en zoekterm
- klantexport in CSV en TXT
- accountverwijdering door admin
- wachtwoord reset voor klanten
- PWA-installatie op smartphone en tablet

---

# 2. Onderdelen van het platform

## 2.1 Klanten-app

De klanten-app is bedoeld voor de klant op smartphone en bevat:

- inloggen met Google
- inloggen met e-mail en wachtwoord
- accountregistratie
- wachtwoord vergeten en resetflow
- dashboard met 4 spaarkaarten
- statusbadge en voortgang naar volgend level
- scanpagina voor QR-codes
- beloningspagina met beschikbare en reeds ingewisselde rewards
- live promo-banner vanuit het beheerderspaneel

## 2.2 Beheerderspaneel

Het beheerderspaneel is bedoeld voor de zaak en bevat 5 tabs:

- Nieuwe QR
- Open flessen
- Klanten
- Historiek
- Inwisselen

## 2.3 Database

Alle productiegegevens staan in Supabase. De actuele database gebruikt onder meer:

- `customers`
- `admin_users`
- `customer_transactions`
- `site_settings`

Belangrijke databasefuncties die vandaag actief gebruikt worden:

- `apply_customer_scan`
- `claim_customer_reward`
- `apply_manual_adjustment`
- `merge_customer_by_email`
- `delete_customer_account`

---

# 3. Het beheerderspaneel

## 3.1 Inloggen

Een admin logt in met e-mail en wachtwoord.

Voor correcte productieconfiguratie zijn 2 voorwaarden nodig:

1. Het e-mailadres staat in de omgevingsvariabele `VITE_ADMIN_EMAILS`.
2. Het e-mailadres staat ook in de tabel `admin_users` in Supabase.

De handleiding gebruikt bewust geen hardcoded wachtwoorden of publieke beheer-URL's. Vul hier intern jullie echte beheer-URL in:

- Beheer-URL: `[jullie admin-URL]`

## 3.2 Tab: Nieuwe QR

Dit is de standaard werkflow aan de kassa.

### Wat je hier kunt doen

- aantallen kiezen per dranktype
- 1 QR-code genereren voor meerdere consumpties tegelijk
- wachten op scanbevestiging
- automatisch resetten na succesvolle scan

### Ondersteunde dranktypes

- koffie
- wijn
- bier
- frisdrank

### Hoe het werkt

1. Kies per dranktype het juiste aantal via `+` en `-`.
2. Tik op `Genereer QR Code`.
3. Laat de klant de code scannen in de klanten-app.
4. Na verwerking verschijnt een bevestiging met groene check.
5. Het scherm sluit daarna automatisch terug af.

### Belangrijke details

- Een QR-code is cryptografisch ondertekend.
- Een QR-code vervalt na 5 minuten.
- Elke scan krijgt een unieke transactie-ID.
- Dubbele verwerking van dezelfde QR-code wordt door de database geblokkeerd.
- Het QR-scherm reset sowieso na 60 seconden, ook als niemand scant.
- Het beheerderspaneel detecteert een voltooide scan via realtime updates en gebruikt polling als fallback.

## 3.3 Tab: Open flessen

Dit is een nieuwe operationele feature voor producten die snel verkocht moeten worden zodra ze open zijn.

### Wat deze tab vandaag opvolgt

De actuele build volgt 13 risico-items op:

- 12 wijnen of bubbels per glas
- lactosevrije melk als koffie-special

### Twee risiconiveaus

- `Code rood`: absolute prioriteit
- `Code oranje`: huiswijnen en lagere urgentie

### Wat je per product kunt doen

- `+ Nieuwe fles`: start of herstart de timer
- `Zet in promo`: zet meteen een live klantenbanner klaar
- `1 glas verkocht` of `1 koffie verkocht`: verlaagt de resterende inhoud
- `Fles weg`: sluit de fles manueel af en verwijdert ze uit de lijst

### Wat het systeem bewaart

Per actief item:

- openingsmoment
- resterend aantal glazen of koffies
- vervaltijd in uren
- gekoppelde promo-tekst

### Timers

Afhankelijk van het product krijgt een item een venster van:

- 48 uur
- 72 uur

De UI toont:

- niet open
- resterende tijd
- hoeveel tijd het item over tijd is

### Live promo-integratie

Wanneer je een item in promo zet, verschijnt de ingestelde promo meteen in de klanten-app.  
Wanneer de fles op nul staat of manueel gewist wordt, verdwijnt de promo automatisch als die nog aan dat item gekoppeld was.

## 3.4 Tab: Klanten

Dit is het centrale overzicht van alle klanten.

### Bovenste samenvattingskaarten

De actuele build toont hier:

- totaal aantal klanten
- totaal aantal consumpties
- aantal actieve klanten deze maand
- geschatte omzet
- geschatte loyaliteitskorting

### Levelblokken

Er is een aparte teller voor:

- Bronze
- Silver
- Gold
- VIP

### Filters en zoeken

Je kunt klanten filteren op:

- alle levels samen
- Bronze
- Silver
- Gold
- VIP

Daarnaast kun je zoeken op:

- naam
- e-mailadres

### Wat je ziet per klant in het overzicht

- initialen/avatar
- naam
- e-mailadres
- huidig level
- totaal aantal loyaliteitspunten
- aantal punten tot het volgende level
- huidige stempelstand voor de 4 kaarten

### Uitgeklapte klantkaart

Per klant toont het detailpaneel:

- levelbadge
- punten
- favoriete drank
- punten nodig tot volgend level
- geschatte omzet
- geschatte loyaliteitskorting
- aantal bezoeken
- dagen sinds laatste bezoek
- voortgangsbalk binnen het huidige level
- gemiddeld aantal consumpties per bezoek
- totaal aantal consumpties per dranktype
- gemiddelde consumptie per maand per dranktype
- huidige stempelstand per kaart
- openstaande rewards per kaart
- reeds ingewisselde rewards per kaart
- klant-sinds datum

### Extra beheeractie

Onderaan een klantkaart staat `Account verwijderen`.

Deze actie verwijdert:

- de klantrecord in `public.customers`
- de gebruiker in `auth.users`

Gebruik dit alleen wanneer een account echt volledig weg moet.

### Export

De exportknop downloadt 2 bestanden:

- een CSV voor Excel, Google Sheets of import
- een TXT met een leesbaar samenvattend klantoverzicht

De export bevat vandaag onder meer:

- naam
- e-mail
- level
- punten
- huidige stempels
- openstaande rewards
- ingewisselde rewards
- totale consumpties per type
- gemiddeld per maand per type
- aantal bezoeken
- laatste bezoek
- geschatte omzet
- loyaliteitskorting
- klant-sinds datum

## 3.5 Tab: Historiek

Deze tab combineert audittrail en manuele correcties.

### Wat hier gelogd wordt

- scans
- inwisselingen
- manuele correcties

### Wat het overzicht toont

Per transactie:

- type gebeurtenis
- datum en uur
- klantnaam
- klantmail
- medewerker
- samenvattende delta's
- optionele reden
- optionele QR transactie-ID

### Filters in de historiek

- alles
- scans
- inwisselingen
- correcties

### Zoekfunctie

Zoeken werkt op:

- klantnaam
- klantmail
- medewerker
- reden

### Hoeveel historiek zichtbaar is

De UI laadt de recentste 120 transacties.  
De volledige brondata blijft wel in de database staan.

## 3.6 Manuele correcties

In dezelfde tab kun je een formele correctie registreren.

### Verplichte velden

- klant
- reden
- minstens 1 effectieve wijziging

### Wat je kunt corrigeren

- stempels op de huidige kaart
- beschikbare rewards
- reeds ingewisselde rewards
- totaal aantal bezoeken

### Ingebouwde validaties

Het systeem voorkomt dat een correctie de data ongeldig maakt.

Concreet:

- stempels op een lopende kaart moeten tussen 0 en 9 blijven
- beschikbare rewards mogen niet negatief worden
- ingewisselde rewards mogen niet negatief worden
- bezoeken mogen niet negatief worden

### Audittrail

Elke correctie krijgt:

- medewerker-e-mail
- reden
- exacte delta's
- tijdstip

## 3.7 Tab: Inwisselen

Deze tab genereert een QR-code waarmee een klant een reward kan opnemen.

### Werkflow

1. Kies het dranktype dat de klant gratis krijgt.
2. Het systeem maakt een ondertekende redeem-QR.
3. De klant scant die QR in de klanten-app.
4. De database controleert of de klant voldoende rewards heeft.
5. Bij succes wordt de reward afgetrokken en gelogd in de historiek.

Ondersteunde types:

- gratis koffie
- gratis wijn
- gratis bier
- gratis frisdrank

## 3.8 Screensaver

Het beheerderspaneel heeft een ingebouwde screensaver.

### Activering

- start na 60 seconden inactiviteit
- stopt bij aanraken, klikken, scrollen of toetsenbordactiviteit

### Wat de screensaver doet

- toont een reeks sfeerbeelden
- gebruikt meerdere scènes met animatie
- helpt tegen inbranden op vaste displays

---

# 4. De klanten-app

## 4.1 Aanmelden en registreren

De klanten-app ondersteunt vandaag:

- aanmelden met Google
- aanmelden met e-mail en wachtwoord
- nieuw account maken met naam, e-mail en wachtwoord
- wachtwoord vergeten
- wachtwoord opnieuw instellen via herstellink

### Belangrijke nuance

Of een klant na registratie meteen ingelogd wordt, hangt mee af van de Supabase-authconfiguratie.  
De app probeert gebruikers na registratie wel meteen in te loggen als er niet automatisch een sessie wordt teruggegeven.

### Voorwaardenvenster

Op de loginpagina staat een knop om de voorwaarden te openen.

## 4.2 Dashboard

Na het inloggen ziet de klant:

- een welkomstblok met naam
- een levelbadge
- totaal aantal loyaliteitspunten
- voortgang naar het volgende niveau
- een live promo-banner wanneer die actief is
- een beloningsbanner als er openstaande rewards zijn
- 4 spaarkaarten
- een vaste knop `Scan QR Code`

### De 4 spaarkaarten

- koffie
- wijn
- bier
- frisdrank

### Welkomstbonus zichtbaar op de kaart

Als de klant nog recht heeft op de welkomstbonus, toont de app op de betrokken kaart tijdelijke gouden bonusstempels.  
Die visuele markering verdwijnt zodra de eerste bonuscyclus op dat dranktype is afgerond.

## 4.3 QR-code scannen

De scanpagina:

- gebruikt de camera van het toestel
- controleert of de pagina in een veilige context draait
- toont hulp bij geweigerde cameratoegang
- verwerkt zowel scan-QR's als redeem-QR's

### Belangrijk gedrag

- bij een gewone scan worden de consumpties toegevoegd
- bij een redeem-scan wordt een reward afgeboekt
- bij een foutieve of vervalste QR krijgt de klant een foutmelding
- bij een verlopen QR-code moet een nieuwe code gevraagd worden aan de kassa
- bij succes klinkt een bevestigingsgeluid

### Toestelondersteuning

De scanpagina bevat aparte hulpinstructies voor:

- Safari op iPhone of iPad
- Chrome op iPhone of iPad
- Samsung Internet
- Firefox
- standaard Chrome op Android

## 4.4 Beloningspagina

De pagina `Mijn Beloningen` toont:

- openstaande rewards per dranktype
- reeds ingewisselde rewards per dranktype

Als een reward beschikbaar is, kan de klant via deze pagina meteen terug naar de scanner om in te wisselen.

## 4.5 Foutafhandeling bij laden

Als het klantprofiel niet tijdig laadt:

- toont de app eerst een laadscherm
- na 8 seconden verschijnt een hersteloptie
- de klant kan dan herladen of uitloggen

---

# 5. Spaarregels en loyaliteitsniveaus

## 5.1 Basisregels

- 1 consumptie geeft 1 stempel op het juiste type
- 10 stempels op 1 kaart geven 1 reward van dat type
- resterende stempels lopen door naar de volgende kaart
- elk dranktype spaart volledig apart
- rewards blijven apart per dranktype bewaard

## 5.2 Welkomstbonus

De eerste geldige scan van een nieuwe klant activeert automatisch een welkomstbonus.

### Hoe de bonus exact werkt

De bonus geeft `+2 extra stempels` op het eerste dranktype uit deze prioriteitsvolgorde dat in de scan voorkomt:

1. koffie
2. wijn
3. bier
4. frisdrank

Voorbeelden:

- eerste scan met koffie: bonus op koffie
- eerste scan zonder koffie maar met wijn: bonus op wijn
- eerste scan met bier en frisdrank, maar zonder koffie of wijn: bonus op bier

De bonus wordt maar 1 keer per klant toegepast.

## 5.3 Loyaliteitspunten

De klant krijgt ook algemene loyaliteitspunten.  
De actuele berekening in code en database is:

- huidige stempels tellen mee als punten
- openstaande rewards tellen elk als 10 punten
- reeds ingewisselde rewards tellen elk ook als 10 punten

Praktisch betekent dit dat de punten een levenslange consumptiescore voorstellen.

## 5.4 Niveaus

De drempels zijn vandaag:

- Bronze: vanaf 0 punten
- Silver: vanaf 25 punten
- Gold: vanaf 75 punten
- VIP: vanaf 150 punten

De klant en het beheerderspaneel tonen allebei:

- huidig niveau
- totaal aantal punten
- voortgang naar het volgende niveau

---

# 6. Open flessen en live promo's

## 6.1 Promo-bericht

Het systeem heeft 1 globale promo-banner voor klanten.

Die banner kan op 2 manieren gezet worden:

- handmatig via de klanten-tab in het beheerderspaneel
- automatisch via `Zet in promo` bij een open fles

## 6.2 Handmatig promo-bericht

In de klanten-tab kan een medewerker:

- een promo-tekst typen
- die opslaan
- die later wissen

De handmatige invoer in de UI heeft een limiet van 120 tekens.

## 6.3 Promo vanuit open flessen

Elke risico-fles heeft een vooraf ingestelde promo-tekst.  
Wanneer je die activeert, ziet de klant de boodschap live op het dashboard.

---

# 7. Historiek, correcties en audittrail

## 7.1 Welke events worden opgeslagen

In `customer_transactions` worden 3 eventtypes opgeslagen:

- `scan`
- `redeem`
- `adjustment`

## 7.2 Wat er per event meegaat

Afhankelijk van het event worden onder meer bijgehouden:

- klant-ID
- medewerker
- reden
- QR transactie-ID
- stempel-delta per dranktype
- reward-delta per dranktype
- claimed-delta per dranktype
- bezoek-delta
- metadata in JSON
- timestamp

## 7.3 Waarom dit belangrijk is

Deze audittrail maakt het mogelijk om:

- dubbele scans te onderzoeken
- te zien wie een correctie deed
- na te gaan waarom punten of rewards veranderden
- supportvragen correct te reconstrueren

---

# 8. Exporten en klantinzichten

## 8.1 Geschatte omzet

De omzetcijfers in het beheerderspaneel zijn schattingen op basis van vaste richtprijzen in de code:

- koffie: 3 euro
- wijn: 5 euro
- bier: 4 euro
- frisdrank: 3 euro

## 8.2 Loyaliteitskorting

De weergegeven loyaliteitskorting is ook een schatting.  
Ze wordt berekend op basis van reeds ingewisselde rewards en dezelfde richtprijzen.

## 8.3 Favoriete drank

De favoriete drank wordt bepaald door te kijken welk dranktype de hoogste totale levenslange consumptiescore heeft.

## 8.4 Gemiddelden per maand

De app berekent gemiddelden per maand op basis van:

- klant-sinds datum
- totale consumpties per dranktype

---

# 9. Beveiliging, data en beheer

## 9.1 QR-beveiliging

QR-codes worden ondertekend met HMAC-SHA256.  
Daardoor kan de app vervalste of aangepaste codes weigeren.

## 9.2 Replaybescherming

Het systeem gebruikt unieke `tx_id`-waarden.  
De database laat dezelfde transactiereferentie geen tweede keer toe.

## 9.3 Row Level Security

De database gebruikt RLS-regels zodat:

- klanten enkel hun eigen klantrecord mogen lezen en aanpassen
- klanten enkel hun eigen transacties mogen lezen
- admins alle klanten en transacties mogen bekijken
- site-instellingen alleen door admins aangepast mogen worden

## 9.4 Duplicaten bij verschillende loginproviders

Wanneer een klant inlogt met een andere authprovider maar hetzelfde e-mailadres gebruikt, probeert de app duplicaten automatisch samen te voegen via `merge_customer_by_email`.

## 9.5 Accountverwijdering

Een admin kan een klant volledig verwijderen.  
Die actie verwijdert zowel profieldata als auth-account.

---

# 10. PWA en installatie op toestel

Zowel de klanten-app als het beheerderspaneel zijn opgezet als PWA.

## 10.1 Wat dat praktisch betekent

- de app kan op het beginscherm gezet worden
- de app draait in standalone modus
- basisbestanden worden gecachet met een service worker

## 10.2 Belangrijke nuance

De service worker cachet shell-assets, maar dit is geen volledige offline bedrijfsmodus.  
Voor scans, klantdata, promo's en transacties blijft een werkende netwerkverbinding nodig.

## 10.3 Aanbeveling voor de zaak

Plaats het beheerderspaneel als PWA op de tablet zodat:

- het sneller opent
- de interface schermvullend draait
- personeel niet telkens via de browser moet navigeren

---

# 11. Praktische FAQ

## Een klant zegt dat de QR niet werkt

Controleer dit in volgorde:

1. De QR is niet ouder dan 5 minuten.
2. De klant scant vanuit de Cozy Moments app.
3. De camera heeft toestemming.
4. De klant heeft internet.
5. De QR is nog niet eerder gebruikt.

## Een reward kan niet ingewisseld worden

Mogelijke oorzaken:

- de klant heeft geen openstaande reward van dat type
- de QR is vervallen
- de QR is al eerder gebruikt
- er is een rechten- of databaserespons mislukt

Controleer desnoods de historiek.

## Een scan werd fout geregistreerd

Gebruik `Historiek & correcties` en registreer een manuele correctie met:

- juiste klant
- duidelijke reden
- exacte delta

## Hoe zie ik welke klanten het trouwst zijn?

Gebruik in de klanten-tab:

- de levelfilters
- de puntenweergave
- het aantal bezoeken
- de geschatte omzet

## Hoe zet ik snel een product in de kijker?

Gebruik `Open flessen` en kies `Zet in promo` bij het gewenste item.

---

# 12. Technische bijlage voor beheer

## 12.1 Verplichte omgevingsvariabelen

De actuele code gebruikt deze variabelen:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_QR_SECRET`
- `VITE_ADMIN_EMAILS`

Alleen voor lokale fallback van admin-login:

- `VITE_ADMIN_PASSWORD`

## 12.2 Productievereisten

Voor correcte productie-inzet moet je hebben:

1. een Supabase-project met de actuele `supabase-schema.sql`
2. minstens 1 admingebruiker in Supabase Auth
3. hetzelfde adminadres in `admin_users`
4. hetzelfde adminadres in `VITE_ADMIN_EMAILS`
5. dezelfde `VITE_QR_SECRET` in zowel customer- als business-deployment

## 12.3 Deploystructuur

De codebasis is voorzien voor 2 aparte Vercel-deployments:

- customer build output: `dist/customer`
- business build output: `dist/business`

## 12.4 Teststatus van deze versie

Bij deze update is de codebasis gevalideerd met:

- `npm test`
- `npm run lint`
- `npm run build`

De actuele uitkomst op 9 maart 2026:

- 52 tests geslaagd
- TypeScript-check geslaagd
- customer build geslaagd
- business build geslaagd

## 12.5 Wat expliciet niet meer in deze handleiding staat

Om veiligheidsredenen bevat deze handleiding niet langer:

- echte adminwachtwoorden
- vaste geheime URL's
- voorbeeldcredentials die op productie lijken

Vul zulke gegevens alleen intern aan in een beveiligd beheerdocument.