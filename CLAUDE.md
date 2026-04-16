# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Virtual Snowflake** — a Norwegian forest fire training simulator for DSB/municipal fire departments. Fully client-side; no backend or auth. All UI text and domain variable names are in Norwegian (bokmål).

## Commands

```bash
npm run dev       # Vite dev server on :5173 with HMR
npm run build     # tsc -b && vite build (type-check first)
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Stack

- **React 18** + **TypeScript 5.7** (strict) + **Vite 6**
- **Leaflet 1.9** for interactive map (CartoDB dark tile layer)
- **Tailwind CSS 3.4** + custom CSS (`src/styles/theme.css`) — dark monospace aesthetic
- External APIs (no auth): Overpass/OSM (terrain), Kartverket (elevation), GeoNorge (address search)

## Architecture

### State Management
Single `useReducer` in `App.tsx` — no Context, no external state library. `SimState` (19 fields) is updated via `SimAction` discriminated union. All simulation engines are held in `useRef` (not state) for performance.

### Simulation Phases
`SimPhase`: `setup → running ↔ paused → debrief`. The simulation loop is a `setInterval` at 1000ms (configurable 0.5×–10× via TICK_MS map).

### Engine Layer (`src/engine/`)
- `FireEngine.ts` — cellular automaton spread (8-neighbor); intensity 0–4; probability driven by vegetation, wind (cosine), slope, dryness, energy
- `ResourceEngine.ts` — three unit types: crew (foot, 0.5 cells/tick), helicopter (air, 2 cells/tick, water refill), truck (road-bound, 1.5 cells/tick)
- `GridBuilder.ts` — builds 50m-cell terrain grid from map bounds; fetches elevation (Kartverket) and vegetation (Overpass) concurrently
- `SnapshotManager.ts` — stores up to 300 `SimSnapshot` entries (Uint8Array for compact intensity storage); supports timeline branching

### API Layer (`src/api/`)
- `elevation.ts` — `fetchElevationGrid()` uses 8 concurrent workers; `mockElevation()` is the fallback
- `overpass.ts` — `fetchTerrainFeatures()` for OSM tags; `classifyOsmTags()` maps OSM → `VegetationType`; `searchAddress()` for geocoding

### Rendering
`MapView.tsx` — Leaflet map + Canvas 2D overlay. Canvas renders fire intensity + vegetation tints + resource icons using pixel caching (not DOM elements). Debrief mode: blue→red heatmap showing fire spread order.

### UI
`Sidebar.tsx` — 4 tabs: **K** (Kontroll), **R** (Ressurser), **T** (Tidslinje), **S** (Statistikk). All tab views are inline render functions, not separate components.

## Type System

All types in `src/types/index.ts`. Key ones:
- `GridCell` — elevation, vegetation, fireIntensity (0–4), burnedAt, suppressedAt
- `SimState` / `SimAction` — root state shape and all action variants
- `Resource` — union of crew/helicopter/truck with type-specific capacity fields
- `SimSnapshot` — serialized grid state for timeline; uses Uint8Array

## Gotchas

- `App.tsx` and `Sidebar.tsx` are intentionally large (~20KB each); don't extract unless adding a meaningful abstraction
- Module-level `let resourceCounter` in App.tsx is used for resource naming — not ideal but intentional
- Three `tsconfig` files: root (`tsconfig.json`), app (`tsconfig.app.json`), node tools (`tsconfig.node.json`)
- Leaflet marker icon fix is applied in `main.tsx` (Vite path resolution workaround)
