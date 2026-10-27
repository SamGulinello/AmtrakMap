import { describe, expect, it } from 'vitest';
import { DemoProvider } from '../../src/data/amtraker/demo';

/**
 * These tests exercise the demo provider against the *committed fixture
 * snapshot* of real Amtraker data. They prove the full chain — parser,
 * normalizer, route derivation — works on realistic payloads.
 */
describe('DemoProvider (real snapshot fixture)', () => {
  it('loads and normalizes the full snapshot without crashing', async () => {
    const provider = new DemoProvider();
    const snap = await provider.fetchSnapshot();
    expect(snap.trains.length).toBeGreaterThan(50);
    expect(snap.stations.length).toBeGreaterThan(400);
    expect(snap.routes.length).toBeGreaterThan(10);
    expect(snap.status.dataKind).toBe('demo');
  });

  it('labels all positions as demo, never live', async () => {
    const snap = await new DemoProvider().fetchSnapshot();
    const positioned = snap.trains.filter((t) => t.position);
    expect(positioned.length).toBeGreaterThan(50);
    for (const train of positioned) {
      expect(train.position?.dataKind).toBe('demo');
      expect(train.position?.sourceLabel).toContain('snapshot');
    }
  });

  it('derives national corridor routes with coordinates', async () => {
    const snap = await new DemoProvider().fetchSnapshot();
    const zephyr = snap.routes.find((r) => r.slug === 'california-zephyr');
    expect(zephyr).toBeDefined();
    expect(zephyr?.stationCodes.length).toBeGreaterThan(15);
    const coast = snap.routes.find((r) => r.slug === 'coast-starlight');
    expect(coast).toBeDefined();
    expect(coast?.stationCodes.length).toBeGreaterThan(15);
  });

  it('provides stop predictions with schedules and statuses', async () => {
    const snap = await new DemoProvider().fetchSnapshot();
    const withStops = snap.trains.find((t) => t.stops.length >= 10);
    expect(withStops).toBeDefined();
    const next = withStops?.stops.find((s) => s.status === 'enroute' || s.status === 'station');
    expect(next).toBeDefined();
  });
});
/**
 * The fixture is a fixed capture, so its shape is knowable. Pinning the counts
 * keeps the numbers quoted in README and DATA_SOURCES.md honest, and makes a
 * swapped or truncated fixture fail loudly instead of silently shrinking the map.
 */
describe('demo snapshot coverage', () => {
  it('matches the documented network counts', async () => {
    const snap = await new DemoProvider().fetchSnapshot();
    const counts = {
      trains: snap.trains.length,
      positioned: snap.trains.filter((t) => t.position).length,
      predeparture: snap.trains.filter((t) => t.state === 'predeparture').length,
      stations: snap.stations.length,
      routes: snap.routes.length,
    };
    expect(counts).toEqual({
      trains: 179,
      positioned: 165,
      predeparture: 10,
      stations: 960,
      routes: 47,
    });
  });

  it('withholds positions from trains that have not departed', async () => {
    const snap = await new DemoProvider().fetchSnapshot();
    const predeparture = snap.trains.filter((t) => t.state === 'predeparture');
    expect(predeparture.length).toBeGreaterThan(0);
    // The raw feed carries coordinates for these, but a train sitting at its
    // origin has no journey position to report, so the normalizer drops it.
    for (const train of predeparture) expect(train.position).toBeUndefined();
  });

  it('reports every train as having at least one stop', async () => {
    const snap = await new DemoProvider().fetchSnapshot();
    const noStops = snap.trains.filter((t) => t.stops.length === 0);
    expect(noStops).toEqual([]);
  });
});
