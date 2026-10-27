# Data-source assessment

Written before the map was built around any assumption about Amtrak data, and
kept current as the integration settled.

## Decision

**Amtraker** (`https://api.amtraker.com`, v2 JSON API) is the live source.
A frozen capture of the same API backs demo mode and the automatic fallback.

## What was evaluated, in the order the brief required

### 1. Official Amtrak sites, published feeds, documented APIs

Amtrak's own `amtrak.com` train-status pages and the interactive trackers behind
them are private application endpoints, not a published API. They are undocumented,
are gated behind bot protection, and have no published terms permitting third-party
programmatic use. Consuming them would mean circumventing access controls, which is
out of scope by rule.

Amtrak's developer portal meanwhile does not offer a general-purpose public
train-position API for third-party applications.

**Rejected.** No public, documented, lawfully accessible position feed.

### 2. GTFS static and GTFS Realtime

Amtrak does not publish a public GTFS or GTFS-Realtime feed. Third-party
collections that repackage national GTFS data do not include Amtrak service.
Generic transit feeds are scoped to individual agencies, so a feed for a local
commuter operator says nothing about the national network.

**Rejected.** No legitimate Amtrak GTFS feed exists to consume.

### 3. Reputable third-party rail-data services

Amtraker was evaluated here and selected. It is an established community project
that mirrors Amtrak's train-tracking feed, requires no authentication, and
publishes station metadata, per-stop schedules, predictions, and its own
staleness metrics alongside the positions.

Verified at integration time: `GET https://api.amtraker.com/v2/trains` returns
HTTP 200 with `access-control-allow-origin: *`, so the browser can call it
directly and no backend proxy is needed to protect a credential. There is no
credential to protect. The response includes per-train `lat`/`lon`, `heading`,
`speed`, `eventCode`/`eventName`, `trainTimely`, and a `stations` array carrying
`schArr`, `arr`, `schDep`, `dep` and `status` per stop. `GET /v2/stale` returns
`avgLastUpdate` in milliseconds along with a `stale` flag and per-train
`timeSince` values.

Other commercial trackers surveyed require paid keys, forbid redistribution in
their terms, or provide only web UIs with no documented data access.

### 4. Other lawful sources

OpenStreetMap carries Amtrak route geometry, and MapLibre can render it. It has no
train positions, so it cannot serve the live requirement. The basemap does use
OpenStreetMap data through CARTO tiles, with attribution displayed in the map
corner.

## Live coverage, measured

Counts below are from the committed demo snapshot (`?mode=demo`) and match what
the app reports in its network summary:

| Metric | Count |
| --- | --- |
| Trains in snapshot | 179 |
| Trains reporting a position | 165 |
| Trains predeparture (position withheld) | 10 |
| Stations | 960 |
| Routes | 47 |

These numbers are asserted in `tests/unit/demo-provider.test.ts`, so this table
cannot drift from the fixture without a test failing.

Live mode returns a comparable volume (roughly 155-165 reporting trains at any
moment), which varies with the time of day.

## Fields the source does not provide

The UI omits these rather than inventing them:

- Crew, onboard amenities, and consist details.
- Coach-level occupancy.
- Platform assignment (occasionally present, never reliably populated).
- Any position for a train that has not yet departed its origin. The raw feed does
  carry coordinates for those trains, but they describe a train sitting at its
  origin rather than a journey in progress, so the normalizer withholds the
  position and the train appears in the list but not on the map.

## Semantics that matter, and how they are handled

The provider's data is easy to misread. Three rules are enforced in
`src/data/amtraker/normalize.ts` and pinned by unit tests:

1. **Only the source's own `Departed` stop status marks a stop realized.** The
   provider pre-fills `arr` and `dep` for stops the train has not reached, so a
   future stop's values are projections and are labelled estimates, never
   reported actuals. The destination is projected the same way.
2. **An "estimate" identical to the schedule carries no information** and is
   dropped, so the UI does not dress up the timetable as a prediction.
3. **A delay is computed from the same time that is displayed**, so the badge and
   the stop time can never disagree.

`avgLastUpdate` from `/v2/stale` is milliseconds. Treating it as seconds would
report positions as hours stale.

## Update cadence and rate limits

Upstream refreshes roughly every three minutes. The client polls at that interval
with up to 15 s of jitter, deduplicates in-flight requests, and reuses a successful
snapshot for two minutes. No key, no documented hard limit, and no request volume
that would plausibly burden a volunteer-run service.

## Licensing and attribution

Amtraker is an unofficial community mirror of Amtrak data. It is not affiliated
with or endorsed by Amtrak, and this project states the same in its README and its
data-provenance copy. The app attributes Amtraker wherever it presents a position,
and attributes CARTO and OpenStreetMap for the basemap.

Because the source is unofficial, the app never presents its data as "Amtrak
official". Labels read "Amtraker live feed" in live mode and
"Amtraker snapshot (demo)" in demo mode.

## Fallback strategy

| Situation | Behaviour |
| --- | --- |
| Live request succeeds | Live mode, green live indicators, source label "Amtraker live feed" |
| Network failure (offline, CORS, 429, 502, 503, 504) | Frozen snapshot, demo labels, notice explaining the fallback |
| Other error (unexpected payload, 4xx) | Error state with the message; no silent substitution |
| Browser offline | Offline notice over the last data received |
| Individual position older than 45 min | Position flagged stale and recoloured on the map |
| Missing coordinates on a station or train | That marker is skipped; everything else still renders |

`?mode=demo` pins the snapshot explicitly for tests and offline demonstrations.

## Known weaknesses of this choice

- The source is a third-party mirror, so its continuity is not guaranteed the way
  an official API's would be. The provider interface isolates that risk: replacing
  it means writing one new provider implementation.
- Positions depend on Amtrak's own reporting; a train that stops reporting simply
  disappears from the map rather than being extrapolated.
- No historical archive, so the app shows the present only.
