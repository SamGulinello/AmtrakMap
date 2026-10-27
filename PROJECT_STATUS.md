# Project status

Release candidate. The application builds, runs, and passes its test suites on a
clean checkout.

Last updated: 2026-10-27

## Verification snapshot

| Check | Command | Result |
| --- | --- | --- |
| Strict type check | `npm run typecheck` | Pass, 0 errors |
| Unit tests | `npm run test` | Pass, 41 tests in 3 files |
| Production build | `npm run build` | Pass, no chunk-size warning |
| E2E, desktop (1440x900) | `npm run test:e2e` | Pass, 10 scenarios |
| E2E, mobile (Pixel 7) | `npm run test:e2e` | Pass, 10 scenarios |
| Live data path | manual, live mode | Verified: 163 trains, live labels |

Main bundle is 993 kB (279 kB gzipped). The 1 MB demo fixture is a separate
lazy-loaded chunk, so live users never download it.

## What works

**Map** — nationwide MapLibre view over a CARTO dark basemap. Route corridors,
960 stations, and up to 165 train markers. Zoom, pan, return-to-national-view, and
a corridor visibility toggle. Markers are colour-coded by data kind (live, demo,
stale) with a legend.

**Train detail** — name, number, service date, route, direction, next stop,
operational status, coordinates, speed, heading, last report time, delay summary,
service alerts, and the full stop list. Times are station-local; day changes are
marked; actual, estimate, and scheduled times are visually distinct.

**Station detail** — name, code, address, coordinates, and the trains serving it.

**Search and filter** — one search box across trains, stations, and routes with
grouped results; route and status filters; live-positions-only toggle; reset
filters. Filters drive both the list and the map.

**Data honesty** — every position is labelled with its provenance. Demo data is
never dressed as live. Freshness comes from the provider's own staleness feed, not
from page load time. Future stop times are estimates, never presented as reported
actuals.

**Degraded states** — offline notice, provider-error notice, automatic fallback to
a labelled snapshot on network failure, stale-position flagging, and an explicit
empty state for searches with no matches.

**Responsive** — two-column desktop layout; single-column tablet and mobile with a
drawer for filters, a compact header, and a full-width detail panel.

**Accessibility** — keyboard-operable controls, `/` to focus search, `Escape` to
close panels, real dialog semantics and accessible names on panels, buttons, and
status badges, live-region status notices.

## Test coverage

**Unit (41 tests)**

- `selectors.test.ts` (10): filtering, search across all three entity types,
  network summary, selection resolution.
- `normalize.test.ts` (24): time and date parsing, stop status mapping, delay
  computation, projection-versus-actual rules, station and route derivation,
  malformed-record tolerance.
- `demo-provider.test.ts` (7): full snapshot end-to-end normalization, demo
  provenance on every position, corridor derivation, pinned network counts,
  position withheld from predeparture trains.

**E2E (10 scenarios, run at both viewports)**

1. National map, network summary, demo labelling, freshness wording.
2. Train selection populates the detail panel with stops and provenance.
3. Search filters trains and shows grouped results.
4. Route filter narrows the list; map stays interactive; map controls respond.
5. Station selection shows details and serving trains.
6. Refresh runs and leaves the UI consistent.
7. Escape closes the detail panel.
8. Offline transition shows a notice and clears it on reconnect.
9. Live feed unreachable falls back to a clearly labelled snapshot.
10. A search with no matches shows an explicit empty state.

## Known defects

None known at P0 or P1. See [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) for
deliberate scope boundaries and source-data constraints.

Backlog, in priority order:

- **P2** No marker clustering, so markers overlap in dense corridors at national
  zoom.
- **P2** Corridor geometry is schematic (station-to-station), not surveyed track.
- **P3** No saved views or shareable deep links to a selected train.
- **P3** No route-level service-alert aggregation; alerts appear per train.

## How to run

```bash
npm install
npm run dev                 # http://localhost:5173
npm run dev -- --open       # same, opens a browser
# pin the frozen snapshot:
#   http://localhost:5173/?mode=demo
```

Verification from a clean checkout:

```bash
npm ci
npx playwright install chromium
npm run test:all
```

## Architecture notes for the next contributor

The frontend depends only on `TrainProvider` (`src/data/provider.ts`). Domain types
live in `src/types/domain.ts` and are the contract between data, map, and UI. Adding
a data source means implementing that interface and registering it in
`src/data/index.ts`; nothing in `src/app`, `src/map`, or `src/trains` needs to
change.

Two rules are enforced by tests and should stay that way:

1. An actual time requires the source's own `Departed` stop status. Projections are
   estimates.
2. Data kind (live, demo, stale) drives colour and copy together. A demo snapshot
   never receives a live indicator.
