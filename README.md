# Amtrak Live Explorer

A single-page application that maps Amtrak's nationwide passenger rail network and
the train positions the data source actually publishes. Built with React,
TypeScript, Vite, and MapLibre GL JS.

## What this is

The app has two data modes and always says which one you are looking at:

- **Live** — polls the public [Amtraker](https://amtraker.com) API, which mirrors
  Amtrak's own train-tracking data. Train markers are drawn from the provider's
  reported positions.
- **Demo snapshot** — a frozen capture of real Amtraker data committed to the
  repository. Used by the test suite and as the automatic fallback when the live
  feed is unreachable. Every record is labelled `demo` and the UI says so.

Nothing in the interface invents a position, a delay, or an arrival time. When a
field is missing at the source it is shown as missing.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

Add `?mode=demo` to the URL to pin the app to the frozen snapshot:

```
http://localhost:5173/?mode=demo
```

No API key, no `.env` file, and no backend are required. See
[`.env.example`](.env.example) if you want to override the upstream endpoints.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Strict type check (`tsc -b`) then production build to `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm run typecheck` | TypeScript only |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E against the production build |
| `npm run test:all` | Typecheck, unit, then E2E |

### Running the full verification suite

```bash
npm run test:all
```

Playwright starts `npm run preview` on `http://127.0.0.1:4173` itself. On a fresh
machine, install the browser once:

```bash
npx playwright install chromium
```

E2E runs against `?mode=demo` so results never depend on a live feed being up. The
one exception is the fallback test, which deliberately blocks the upstream API to
prove the app degrades honestly.

## Using the app

- **Search** (press `/` to focus) matches train names and numbers, station names
  and codes, and route names. Results are grouped and selecting one opens its
  detail panel.
- **Route filter** and **status filter** (Active / Predeparture) narrow both the
  list and the map. **Reset filters** restores the nationwide view.
- **Select a train** from the list or the map to open the detail panel: route,
  direction, next stop, status, coordinates, speed, heading, last report time,
  and the full stop list with scheduled and reported or estimated times.
- **Select a station** to see its address, coordinates, and the trains serving it.
- **Map controls**: zoom, an imperial scale, and the ⌂ button returns to the
  national view. **Corridors** toggles the route lines independently of the
  train markers. Selecting a train adds a **Center train** button on the map.
- **Escape** closes an open detail panel.
- Below 860 px the filter panel becomes a drawer opened from the ☰ button.

## Data source

**Selected source: [Amtraker](https://amtraker.com)** — a public, unauthenticated
JSON API that serves Amtrak train positions, stop-level schedules and predictions,
station metadata, and a feed-staleness summary.

| Endpoint | Provides |
| --- | --- |
| `GET /v2/trains` | All active trains with positions, heading, speed, and per-stop times |
| `GET /v2/stations` | Station names, codes, timezones, coordinates, address |
| `GET /v2/stale` | Average age of each train's last position report, plus a stale flag |

See [`DATA_SOURCES.md`](DATA_SOURCES.md) for the full assessment: what was
evaluated, what was rejected and why, licensing, rate limits, and the fallback
strategy.

### Freshness, not just timestamps

The header shows when the app last *read* the feed. That is not the same as how
old the data is. Actual data age comes from the provider's staleness summary and
appears in the network summary panel, for example "Positions reported on average
5 min ago". A position older than 45 minutes is flagged stale and changes colour
on the map.

### Fallback behaviour

If the live request fails with a network-level error (offline, CORS rejection,
429, 502, 503, 504), the app falls back to the frozen snapshot, labels it as such,
and shows a notice explaining why. Other errors surface as an error state rather
than being papered over.

## Architecture

```
src/
  types/          Shared domain types: Route, Station, Train, TrainPosition,
                  StopPrediction, ServiceAlert, DataSourceStatus
  data/           Provider abstraction, Amtraker client, normalization, caching,
                  fixture-backed demo provider, route metadata
  hooks/          Snapshot lifecycle (load, bounded polling, manual refresh),
                  connectivity tracking
  map/            MapLibre setup, route/station/train layers, route colour
                  palette, selection, controls
  trains/         Search, filtering, selection selectors; train detail panel
  app/            Shell, header, sidebar, station panel, data notices
  components/     Reusable primitives (status dots, map UI)
  utils/          Time formatting and other pure helpers
tests/
  unit/           Vitest: selectors, normalization, demo provider
  e2e/            Playwright: desktop and mobile flows, degraded conditions
```

The frontend talks only to the `TrainProvider` interface. Swapping data sources
means writing one new provider, not touching components.

Polling runs every three minutes with jitter, matching the upstream refresh
cadence, and in-flight requests are deduplicated. Selecting a train or a station
never triggers a network request.

## Known limitations

See [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md). The short version: Amtraker is
an unofficial third-party mirror rather than an Amtrak-published API, positions
are only available for trains currently reporting, and times are shown in each
station's local timezone without conversion to the viewer's.

## Attribution

- Train and station data: [Amtraker](https://amtraker.com), which serves Amtrak
  data. Not affiliated with or endorsed by Amtrak.
- Basemap: [CARTO](https://carto.com/about-carto/) dark-matter tiles on
  [OpenStreetMap](https://www.openstreetmap.org/copyright) data, with CARTO's
  attribution shown in the map corner.
- Mapping library: [MapLibre GL JS](https://maplibre.org).

This is an independent project and is not affiliated with Amtrak.
