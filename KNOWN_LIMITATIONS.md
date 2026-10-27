# Known limitations

Things this application does not do, stated plainly so nobody mistakes a gap for a
bug or, worse, for real data.

## Data source

**Amtraker is not an official Amtrak API.** It is an independent community mirror
of Amtrak's train-tracking data. Continuity, uptime, and schema stability are not
guaranteed by anyone. The provider interface isolates this: replacing the source
means writing one new `TrainProvider`, not touching components.

**Amtrak publishes no public train-position API and no GTFS feed.** There was no
official source to use. See [`DATA_SOURCES.md`](DATA_SOURCES.md) for the full
assessment of what was evaluated and rejected.

**Positions depend on Amtrak's own reporting.** A train that stops reporting does
not get extrapolated. It either freezes at its last position and is flagged stale
after 45 minutes, or drops off the map. No position is ever interpolated or
predicted to fill a gap.

**No historical data.** The source serves the present. There is no archive, no
playback, no on-time-performance history.

**On-time percentages are the source's own.** `trainTimely` is passed through as
the provider reports it. The app does not recompute it from stop data, because
doing so would create a second, conflicting number.

## Interpretation of the source data

**A stop is "actual" only when the source says it departed.** The provider
pre-fills `arr` and `dep` for stops ahead of the train, including the destination.
Those values are projections. The app labels them estimates, and drops an estimate
that merely repeats the schedule. If you compare the app against another Amtrak
tracker, an "estimate" here may look like a confirmed time there; the difference is
that the other tool is trusting a projection.

**Times are station-local wall-clock times, not viewer-local.** A stop scheduled
for 9:00 AM in New Orleans reads 9:00 AM regardless of where you are. This matches
how Amtrak publishes timetables and avoids silently shifting times across time
zones. It does mean a trip spanning zones shows a clock that jumps. Day changes are
marked rather than hidden.

**Service dates distinguish duplicate train numbers.** Long-distance trains reuse
numbers across days, so the same number can appear several times in the list. Each
entry shows its service date.

**The network is the source's roster, not an Amtrak timetable.** Stations and
routes are derived from trains currently in the feed. A route with no train
running right now may not appear as a corridor line, and a station served only by
a suspended route may be missing.

## Rendering and interaction

**Marker clustering is not implemented.** All positioned trains render as
individual markers. Marker size scales with zoom (smaller at the national view,
full size from zoom 7) so trains stay distinguishable in dense corridors such as
the Northeast, but overlapping markers there still cannot be selected individually
without zooming in.

**A portrait phone cannot frame the country without spare room.** The national view
fits the continental bounding box, which on a tall narrow screen leaves ocean and
Canada above and below. Cropping to the US would hide the network's edges, so the
spare room is kept.

**The corridor geometry is schematic.** Route lines connect stations in sequence
rather than following surveyed track. They indicate which stations belong to a
route, not the exact alignment of the railroad.

**The map depends on a third-party basemap.** Tiles come from CARTO on
OpenStreetMap data, subject to CARTO's usage policy. If that service is blocked or
unavailable, the map background fails to load even though the data layers are
fine. `VITE_MAP_STYLE_URL` allows pointing at a different MapLibre style.

**The builder chunk warning is expected.** MapLibre is roughly 1 MB minified and
is needed before the map can paint, so it cannot be lazily loaded. It is split into
its own vendor chunk so it caches separately from application code; the rest of the
bundle stays small.

**No offline caching of the map.** Going offline shows the last data received plus
a notice, but basemap tiles already drawn are all that remains visible.

**Background tabs are throttled by the browser.** The app does not pause polling
itself, but browsers slow timers in hidden tabs, so a tab left in the background
can show older data when you return to it. The header states when the feed was
last read, and the network summary states the age of the positions, so a stale tab
is not presented as current.

## Scope

**Not an operational or safety tool.** Do not use this to plan a journey, catch a
connection, or make any decision where a wrong time matters. It is a visualization
of a third-party feed.

**No user accounts, saved views, or alerts.** Filters live in memory and reset on
reload.

**Amtrak branding is not used.** No Amtrak logo or wordmark is reproduced. The name
"Amtrak Live Explorer" describes the subject matter, and both the README and the
in-app provenance copy state that this is an unaffiliated project.
