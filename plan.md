# Virtual Snowflake — Skogbrann-treningssimulator

## Kontekst

Profesjonelle brannmenn mangler et digitalt verktøy for realistisk skogbranntrening. All øvelse skjer i dag i felt, som er kostbart og vanskelig å gjennomføre hyppig. Dette er for en ekte organisasjon (DSB / kommunal brannvern). En instruktør setter opp og kjører skogbrannscenarier basert på ekte norsk terreng. Mannskapet øver på ressursdisponering mens instruktøren manipulerer variabler live og spoler tidslinjen frem og tilbake for debriefing.

---

## Kjernefunksjoner

### 1. Kart og terreng
- Søk opp hvilket som helst sted i Norge (adresse eller koordinat)
- Rutenett-lag (grid) over kartet — hver celle har: høyde, vegetasjonstype, vann/sjø, vei, bebyggelse
- Datakilder:
  - Kartverkets høydedata-API (hoydedata.no) for topografi
  - OpenStreetMap via Overpass API for veier, vann, bebyggelse
  - NIBIO AR5 eller OpenStreetMap for vegetasjonstype (barskog / løvskog / myr / åpen mark)

### 2. Brannfysikk — cellulær automat
- Instruktør klikker startpunkt på kart
- Variabler (alle justerbare live med sliders):
  - Energinivå (lav / middel / høy)
  - Vindretning (0–360°)
  - Vindstyrke (m/s)
  - Tørrhetsnivå (0–100%)
- Spredningsregler per celle-tick:
  - Raskere oppover skråning, tregere nedover
  - Barskog: høy antennbarhet; løvskog: middels; myr: null; åpen mark: lav
  - Stopper ved vann/sjø-celler
  - Vind: sannsynlighet for spredning øker sterkt i vindretning

### 3. Ressurser (manuell plassering — klikk på kart)

| Ressurs | Stats | Begrensninger |
|---|---|---|
| Brannmannskap til fots | Antall, hastighet, slokkingskapasitet, utholdenhet | Beveger seg fritt |
| Helikopter | Tankerkapasitet, flyhastighet, rekkevidde, fylletid | Henter vann fra vann/sjø-celler |
| Brannbil/tankvogn | Kapasitet, hastighet | Kun langs veiceller |

- Alle stats justeres live med sliders i sidepanel under simuleringen

### 4. Tidslinje
- State-snapshot lagres per tidsskritt (brannrutenett + ressursposisjoner + variabelstatus)
- Kontroller: Pause / Play / Hastighet (0.5× – 10×)
- Spol tilbake til et vilkårlig tidspunkt på tidslinjen
- Kjør på nytt fra det punktet med andre beslutninger (what-if-analyse)

### 5. Score og debriefing
- Løpende statistikk: areal brent (m²/celler), ressurser brukt, tid brukt
- Ingen hard vinn/tap — instruktøren debriefier basert på tallene

---

## Design System — War Room / NATO ops center

Stilen er mørk, taktisk og profesjonell — som et kommandosenter. Monospace-font, amber/rød aksenter, høy kontrast.

### Layout

```
┌─────────────────────────────────────────────────┐
│  ▲ VIRTUAL SNOWFLAKE    [Søk: "Froland..."] [🔍]│  ← Header (48px)
├──────────┬──────────────────────────────────────┤
│ SIDEBAR  │                                      │
│ 280px    │         KART (Leaflet)               │
│          │                                      │
│ [K][R]   │    + Canvas overlay (brann + grid)   │
│ [T][S]   │                                      │
│          │                                      │
├──────────┴──────────────────────────────────────┤
│  [⏮][⏸][▶][⏭]  [====|====] 14:32  ×1  [BRANCH]│  ← Tidslinje (56px)
└─────────────────────────────────────────────────┘
```

Sidebar-faner: **K**=Kontroller · **R**=Ressurser · **T**=Tidslinje · **S**=Statistikk

### Fargepalett

```css
--bg-primary:    #0a0e1a;   /* Meget mørk navy */
--bg-secondary:  #111827;   /* Sidebar bakgrunn */
--bg-card:       #1f2937;   /* Panel/card bakgrunn */
--accent-amber:  #f59e0b;   /* Primær aksentfarge */
--accent-red:    #ef4444;   /* Brann/fare */
--accent-green:  #10b981;   /* Aktiv ressurs */
--text-primary:  #f3f4f6;
--text-mono:     'Courier New', monospace;
--border:        #374151;
```

### Brannvisualisering — varmekart-gradient

```
intensitet 0: transparent (ingen brann)
intensitet 1: rgba(250, 204, 21, 0.6)   /* Gul — gløder */
intensitet 2: rgba(249, 115, 22, 0.7)   /* Oransje — brenner */
intensitet 3: rgba(239, 68, 68, 0.8)    /* Rød — intenst */
intensitet 4: rgba(31, 41, 55, 0.85)    /* Charcoal — brent ut */
```

### Ressurs-ikoner (Canvas, NATO-inspirert)

- Helikopter: sirkel med rotorstreker, pulserer ved aktivitet
- Mannskap: liten firkant med kors
- Tankvogn: rektangel med retningspil
- Tom for vann: ikonet pulserer gult
- Ved brannkant: ikonet lyser rødt

### Kart

- Mørkt kartlag: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`
- Kompass-rose overlay øverst høyre — oppdateres med vindretning
- Vindpil på kartet som viser retning og styrke

### Tidslinje

```
[⏮] [⏸] [▶] [⏭]   [══════════|═══] 14:32   ×1 ×2 ×5 ×10   [BRANCH HER]
```

- Klokkeslett: hh:mm siden simulasjonsstart
- Branch-punkt markeres med `◆` på scrubber

### Ressurs-UX i sidebar

```
┌─────────────────────────┐
│ △ HELIKOPTER 1   [✕]   │  ← Valgt ressurs øverst
│ Tank: [=======--] 70%  │
│ Hast: [====-----] 8m/s │
│ Status: AKTIV           │
├─────────────────────────┤
│ [+ LEGG TIL RESSURS]    │
│ [△] Helikopter          │
│ [■] Mannskap            │
│ [▶] Tankvogn            │
└─────────────────────────┘
```

### Varsler

Kun visuell feedback direkte på kartet — ingen popups, ingen lyd.
- Bygning i fare: cellen pulserer rødt
- Ressurs tom: ikonet pulserer gult

### Debriefing-modus

Knapp `[DEBRIEF-MODUS]` i statistikk-fanen:
- Sidebar skjules
- Tidslinje i full bredde
- Brann-replay med animasjon
- Brannutviklingskart: alle brente celler fargekodet etter tidspunkt for antenning

### Klasseromsvisning

`[FULLSKJERM]`-knapp i header → skjuler header og sidebar → rent kart + tidslinje for projeksjon.

### Loading / feilhåndtering

- Under API-kall: mørk overlay med `[ LASTER TERRENGDATA... ]`
- Ved API-timeout: fallback til flat mock-grid + melding `[ API UTILGJENGELIG — BRUKER TESTDATA ]`

---

## Teknisk arkitektur

| Del | Teknologi |
|---|---|
| Frontend/UI | React + TypeScript + Tailwind CSS |
| Kartviser | Leaflet.js (gratis, OSM-basert) |
| Høydedata | Kartverkets høydedata REST-API |
| Vegetasjon/veier/vann | OpenStreetMap via Overpass API |
| Brannmotor | Custom cellular automaton på HTML5 Canvas (overlay på Leaflet) |
| Tilstandshåndtering | React state + snapshot-array for tidslinje |
| Backend | Ingen — alt kjører i nettleseren |
| Bygg | Vite + TypeScript |

---

## Implementasjonsplan (steg for steg)

### Fase 1: Prosjektoppsett
- [ ] `npm create vite@latest virtual-snowflake -- --template react-ts`
- [ ] Installer: `leaflet`, `@types/leaflet`, `tailwindcss`, `postcss`, `autoprefixer`
- [ ] Konfigurer Tailwind med custom dark fargepalett
- [ ] Global CSS: War Room-tema, monospace font, mørk bakgrunn

### Fase 2: Layout og shell
- [ ] App.tsx: header + sidebar (280px, 4 faner) + kart + tidslinje i bunn
- [ ] Søkefelt i header med Nominatim geocoding

### Fase 3: Kart og grid
- [ ] Leaflet med mørkt kartlag (CartoDB Dark)
- [ ] Canvas-overlay på Leaflet for grid-visualisering
- [ ] Kompass-rose overlay på kartet
- [ ] Last ned terrengdata for valgt område:
  - Kartverkets API for høydedata
  - Overpass API for veier, vann, vegetasjon
- [ ] Loading-overlay + fallback til mock-data ved API-feil
- [ ] Konverter til intern 2D-array av celler (GridCell-type)

### Fase 4: Brannmotor
- [ ] `FireEngine`-klasse: tar GridCell[][], vindvektor, tørrhet
- [ ] `tick()`-metode: beregner hvilke celler antennes neste steg (intensitet 0–4)
- [ ] Canvas-render: heatmap-gradient per intensitetsnivå
- [ ] Kontroller-fane i sidebar: kompass-widget for vind, sliders, energi-knapper, [SETT ILD]

### Fase 5: Ressurser
- [ ] Klikk på kart plasserer valgt ressurs
- [ ] Sidebar oppdateres med valgt ressurs øverst i Ressurser-fanen
- [ ] NATO-inspirerte Canvas-ikoner med animasjon (tom/aktiv-tilstand)
- [ ] `ResourceEngine`: beregn bevegelse og slokkingseffekt
- [ ] Helikopter: beregn nærmeste vann-celle for refill

### Fase 6: Tidslinje
- [ ] `SnapshotManager`: deep copy via `structuredClone` per tick
- [ ] Timeline-komponent: scrubber + klokkeslett + hastighetsknapper
- [ ] "BRANCH HER"-knapp: laster snapshot, markerer `◆` på scrubber

### Fase 7: Statistikk og debriefing
- [ ] Statistikk-fane: brent areal, tid, ressursbruk
- [ ] Debrief-modus: full bredde, replay, brannutviklingskart

### Fase 8: Polish
- [ ] Fullskjerm-modus for klasseromsprosjeksjon
- [ ] Legende på kart (vegetasjonstype + brannintensitet)
- [ ] Responsivt layout for >1920px

---

## Kritiske filer å opprette

```
virtual-snowflake/
├── src/
│   ├── components/
│   │   ├── MapView.tsx          # Leaflet + Canvas overlay + kompass-rose
│   │   ├── Sidebar.tsx          # 4-fane sidebar med alle kontroller
│   │   ├── Timeline.tsx         # Scrubber + play-kontroller + branch
│   │   ├── ScorePanel.tsx       # Statistikk + debrief-modus
│   │   └── ResourceIcon.tsx     # NATO-inspirert ikonrendering på Canvas
│   ├── engine/
│   │   ├── FireEngine.ts        # Cellulær automat-logikk
│   │   ├── GridBuilder.ts       # Konverter API-data til GridCell[][]
│   │   ├── ResourceEngine.ts    # Ressurs-bevegelse og slokkingseffekt
│   │   └── SnapshotManager.ts   # Tidslinje-snapshots (structuredClone)
│   ├── api/
│   │   ├── elevation.ts         # Kartverkets høydedata-API
│   │   └── overpass.ts          # OpenStreetMap Overpass-spørringer
│   ├── types/
│   │   └── index.ts             # GridCell, Resource, FireState, Snapshot
│   ├── styles/
│   │   └── theme.css            # CSS-variabler for War Room-tema
│   └── App.tsx
```

---

## Ikke med i MVP
- Innlogging / auth
- Lagre og gjenbruke scenarier
- Automatisk pathfinding for ressurser
- Bulldozer / branngater
- Lyd / varselslyder
- Eksport til PDF

---

## Verifisering

1. Start dev-server: `npm run dev`
2. Verifiser War Room-tema: mørk bakgrunn, monospace font, amber aksenter
3. Søk opp "Froland, Aust-Agder" — kart navigerer dit, grid lastes
4. Sett vind nordøst 8 m/s, tørrhet 90%, energi "høy"
5. Klikk [SETT ILD] → klikk startpunkt i barskogområde — heatmap-gradient starter
6. Brann sprer seg nordøst, stopper ved vann
7. Plasser helikopter ved innsjø, se det fly til brann og slokke
8. Spol tilbake 2 minutter → [BRANCH HER] → plasser mannskap annerledes → bekreft ny kjøring
9. Åpne Statistikk-fane → trykk [DEBRIEF-MODUS] → replay på full skjerm
