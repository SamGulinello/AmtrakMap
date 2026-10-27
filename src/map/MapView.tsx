/**
 * MapLibre-based national map of the Amtrak network.
 *
 * Layers:
 *  - `corridor-dim` / `corridor-active`: route polylines derived from station
 *    sequences (the source publishes no geometry), colored per route.
 *  - `stations`: circle layer over station coordinates.
 *  - `trains`: circle layer over verified train positions; color encodes
 *    provenance (live / demo / stale) and the selected train is enlarged.
 *
 * Selection is handled by changing the train feature's radius; station clicks
 * fall through to the app-level selection. Filters update layer filters, so
 * the map stays in sync with the sidebar without re-populating data.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 derives its worker URL from import.meta.url, which points at the
// bundled chunk rather than the package directory. Emitting the worker as an
// asset and registering it explicitly is what keeps tiles rendering in a build.
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { AppFilters } from '../data/provider';
import type { NetworkSnapshot } from '../data/provider';
import type { GeoPoint } from '../types/domain';
import type { Selection } from '../app/App';

export const US_CENTER: GeoPoint = { lat: 39.5, lon: -98.35 };
export const US_ZOOM = 3.1;

/** Bounding box of the contiguous United States, used for the national view. */
const CONUS_BOUNDS: [[number, number], [number, number]] = [
  [-125.5, 24.0],
  [-66.5, 49.5],
];

maplibregl.setWorkerUrl(mapWorkerUrl);

function nationalView(map: maplibregl.Map, animate: boolean): void {
  const options = {
    padding: { top: 24, bottom: 24, left: 24, right: 24 },
    duration: animate ? 600 : 0,
  };
  map.fitBounds(CONUS_BOUNDS, options);
}

const STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL ??
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const TRAIN_COLOR_LIVE = '#4ade80';
const TRAIN_COLOR_DEMO = '#f59e0b';
const TRAIN_COLOR_STALE = '#fbbf24';

const ROUTE_PALETTE = [
  '#e0a03c', '#7ea0e0', '#9b7de0', '#5bc0a8', '#d9706c',
  '#c98d3c', '#6aa8d0', '#a8b05c', '#c06ca0', '#6cc9d0',
];

function routeColor(slug: string): string {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ROUTE_PALETTE[h % ROUTE_PALETTE.length];
}

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

interface MapProps {
  snapshot: NetworkSnapshot | undefined;
  filters: AppFilters;
  selection: Selection;
  onSelectTrain: (id: string) => void;
  onSelectStation: (code: string) => void;
}

export function MapView({ snapshot, filters, selection, onSelectTrain, onSelectStation }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | undefined>(undefined);
  const callbacksRef = useRef({ onSelectTrain, onSelectStation });
  const selectionRef = useRef<Selection>(null);
  const [ready, setReady] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);

  callbacksRef.current = { onSelectTrain, onSelectStation };
  selectionRef.current = selection;

  // Create the map exactly once.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = new maplibregl.Map({
      container: el,
      style: STYLE_URL,
      center: [US_CENTER.lon, US_CENTER.lat],
      zoom: US_ZOOM,
      minZoom: 2,
      maxZoom: 12,
      attributionControl: false,
      dragRotate: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

    map.on('load', () => {
      map.addSource('corridors', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'corridor-dim',
        type: 'line',
        source: 'corridors',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#22304f', 'line-width': 1.8, 'line-opacity': 0.9 },
      });
      map.addLayer({
        id: 'corridor-active',
        type: 'line',
        source: 'corridors',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 2.8, 'line-opacity': ['get', 'active'] },
      });

      map.addSource('stations', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'stations',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': 2.4,
          'circle-color': '#7c93b8',
          'circle-stroke-width': 0.5,
          'circle-stroke-color': '#0b1220',
          'circle-opacity': 0.9,
        },
      });

      map.addSource('trains', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'train-halo',
        type: 'circle',
        source: 'trains',
        paint: {
          // Shrink the halo at national zoom, where 165 markers otherwise merge
          // into a single blob in dense corridors.
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            2, ['*', ['get', 'halo'], 0.4],
            5, ['*', ['get', 'halo'], 0.75],
            7, ['get', 'halo'],
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.22,
        },
      });
      map.addLayer({
        id: 'trains',
        type: 'circle',
        source: 'trains',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            2, ['*', ['get', 'radius'], 0.4],
            5, ['*', ['get', 'radius'], 0.75],
            7, ['get', 'radius'],
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.6,
          'circle-stroke-color': '#0b1220',
          'circle-opacity': 0.95,
        },
      });

      map.on('click', 'trains', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === 'string') callbacksRef.current.onSelectTrain(id);
      });
      map.on('click', 'stations', (e) => {
        const code = e.features?.[0]?.properties?.code;
        if (typeof code === 'string') callbacksRef.current.onSelectStation(code);
      });
      for (const layer of ['trains', 'stations']) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
      }

      nationalView(map, false);
      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = undefined;
    };
  }, []);

  // Populate corridors, stations, and trains from the snapshot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !snapshot) return;

    // Corridors: one line per route, geometries from station coordinates.
    const lineFeatures = snapshot.routes
      .filter((r) => r.stationCodes.length >= 2)
      .map((r) => {
        const coords: [number, number][] = [];
        for (const code of r.stationCodes) {
          const s = snapshot.stations.find((st) => st.code === code);
          if (!s?.position) continue;
          coords.push([s.position.lon, s.position.lat]);
        }
        if (coords.length < 2) return null;
        return {
          type: 'Feature' as const,
          properties: { slug: r.slug, color: routeColor(r.slug), active: 1 },
          geometry: { type: 'LineString' as const, coordinates: coords },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const source = map.getSource('corridors') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData({ type: 'FeatureCollection', features: lineFeatures });
      // Route filter highlights only the filtered corridor.
      const activeFilter = ['==', ['get', 'slug'], filters.routeSlug] as unknown as maplibregl.FilterSpecification;
      const none = ['==', ['get', 'slug'], '__never__'] as unknown as maplibregl.FilterSpecification;
      map.setFilter('corridor-active', filters.routeSlug ? activeFilter : undefined);
      map.setFilter('corridor-dim', filters.routeSlug ? none : undefined);
    }

    // Stations.
    const stationFeatures = snapshot.stations
      .filter((s) => s.position)
      .map((s) => ({
        type: 'Feature' as const,
        properties: { code: s.code, name: s.name },
        geometry: { type: 'Point' as const, coordinates: [s.position!.lon, s.position!.lat] as [number, number] },
      }));
    (map.getSource('stations') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: stationFeatures,
    });

    // Trains (apply train filters here; selection handled below).
    syncTrains(map, snapshot, filters, selection);
  }, [snapshot, filters, ready, selection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !snapshot) return;
    syncTrains(map, snapshot, filters, selection);
  }, [snapshot, filters, ready, selection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty('corridor-dim', 'visibility', showRoutes ? 'visible' : 'none');
    map.setLayoutProperty('corridor-active', 'visibility', showRoutes ? 'visible' : 'none');
  }, [showRoutes, ready]);

  const zoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const zoomOut = useCallback(() => mapRef.current?.zoomOut(), []);
  const resetView = useCallback(() => {
    const map = mapRef.current;
    if (map) nationalView(map, true);
  }, []);
  const flyToSelectedTrain = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel || sel.type !== 'train' || !snapshot) return;
    const train = snapshot.trains.find((t) => t.id === sel.trainId);
    const p = train?.position;
    if (!p) return;
    mapRef.current?.easeTo({ center: [p.lon, p.lat], zoom: Math.max(mapRef.current?.getZoom() ?? 3, 5.5) });
  }, [snapshot]);

  const trainSelectionValid =
    selection?.type === 'train' &&
    !!snapshot?.trains.find((t) => t.id === selection.trainId && t.position);

  return (
    <div className="map-pane">
      <div ref={containerRef} className="map-canvas" data-testid="map" />
      {ready && (
        <>
          <div className="map-overlay legend" data-testid="map-legend">
            <div className="legend-item"><span className="status-dot live" />Live train</div>
            <div className="legend-item"><span className="status-dot demo" />Demo snapshot</div>
            <div className="legend-item"><span className="status-dot stale" />Stale position</div>
            <div className="legend-item">
              <span style={{ display: 'inline-block', width: 14, height: 3, background: '#7c93b8', borderRadius: 1, marginRight: 5 }} />
              Rail corridor
            </div>
          </div>
          <div className="map-overlay zoom-controls">
            <button className="zoom-btn" onClick={zoomIn} aria-label="Zoom in">+</button>
            <button className="zoom-btn" onClick={zoomOut} aria-label="Zoom out">−</button>
            <button className="zoom-btn" onClick={resetView} aria-label="Return to national view" data-testid="reset-view">⌂</button>
          </div>
          <div className="map-overlay network-toggle" data-testid="route-toggle">
            <button className={showRoutes ? 'active' : ''} onClick={() => setShowRoutes((v) => !v)}>
              {showRoutes ? 'Corridors on' : 'Corridors off'}
            </button>
          </div>
          {trainSelectionValid && (
            <button
              className="map-overlay btn"
              style={{ right: 14, bottom: 58 }}
              onClick={flyToSelectedTrain}
              data-testid="center-train"
            >
              Center train
            </button>
          )}
        </>
      )}
    </div>
  );
}

function syncTrains(
  map: maplibregl.Map,
  snapshot: NetworkSnapshot,
  filters: AppFilters,
  selection: Selection,
) {
  const source = map.getSource('trains') as maplibregl.GeoJSONSource | undefined;
  if (!source) return;

  const features = snapshot.trains
    .filter((t) => {
      if (filters.routeSlug && t.routeSlug !== filters.routeSlug) return false;
      if (filters.trainState !== 'all' && t.state !== filters.trainState) return false;
      if (filters.onlyWithPosition && !t.position) return false;
      return true;
    })
    .filter((t) => t.position)
    .map((t) => {
      const selected = selection?.type === 'train' && t.id === selection.trainId;
      const color = t.isStale ? TRAIN_COLOR_STALE : t.position?.dataKind === 'demo' ? TRAIN_COLOR_DEMO : TRAIN_COLOR_LIVE;
      return {
        type: 'Feature' as const,
        properties: {
          id: t.id,
          color,
          radius: selected ? 14 : 8,
          halo: selected ? 26 : 16,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [t.position!.lon, t.position!.lat] as [number, number],
        },
      };
    });

  source.setData({ type: 'FeatureCollection', features });
}