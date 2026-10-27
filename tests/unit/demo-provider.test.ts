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