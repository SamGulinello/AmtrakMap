import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProvider, type ProviderMode } from '../data';
import { emptyFilters, type AppFilters } from '../data/provider';
import { useNetworkData } from '../hooks/useNetworkData';
import {
  filterTrains,
  searchAll,
  sortTrains,
  summarizeNetwork,
  uniqueRouteNames,
} from '../trains/selectors';
import { MapView } from '../map/MapView';
import { Sidebar } from './Sidebar';
import { TrainDetailPanel } from '../trains/TrainDetailPanel';
import { StationDetailPanel } from './StationDetailPanel';
import { Header } from './Header';

export type Selection =
  | { type: 'train'; trainId: string }
  | { type: 'station'; stationCode: string }
  | null;

/**
 * Main application shell: owns the provider, the snapshot lifecycle, filters,
 * and selection. Renders header, map, sidebar, and detail overlay.
 */
export default function App() {
  const [mode] = useState<ProviderMode>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'demo' || import.meta.env.VITE_DATA_MODE === 'demo') {
      return 'demo';
    }
    return 'live';
  });

  const provider = useMemo(() => getProvider(mode), [mode]);
  const { snapshot, status, refresh, hasLoadedOnce } = useNetworkData(provider);
  const [filters, setFilters] = useState<AppFilters>(emptyFilters);
  const [selection, setSelection] = useState<Selection>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const trains = snapshot?.trains ?? [];
  const stations = snapshot?.stations ?? [];
  const routes = snapshot?.routes ?? [];

  const summary = useMemo(() => summarizeNetwork(trains, stations, routes), [trains, stations, routes]);
  const routeNames = useMemo(() => uniqueRouteNames(trains), [trains]);

  const filteredTrains = useMemo(() => sortTrains(filterTrains(trains, filters)), [trains, filters]);

  const selectedTrain = useMemo(
    () => (selection?.type === 'train' ? trains.find((t) => t.id === selection.trainId) : undefined),
    [selection, trains],
  );
  const selectedStation = useMemo(
    () => (selection?.type === 'station' ? stations.find((s) => s.code === selection.stationCode) : undefined),
    [selection, stations],
  );

  const setQuery = useCallback((query: string) => {
    setFilters((f) => ({ ...f, query }));
  }, []);

  const onSelectTrain = useCallback((trainId: string) => {
    setSelection({ type: 'train', trainId });
    setSidebarOpen(false);
  }, []);

  const onSelectStation = useCallback((stationCode: string) => {
    setSelection({ type: 'station', stationCode });
    setSidebarOpen(false);
  }, []);

  const searchQuery = filters.query;
  const searchResults = useMemo(
    () => (searchQuery.trim() ? searchAll(trains, stations, routes, searchQuery) : undefined),
    [searchQuery, trains, stations, routes],
  );

  // Keyboard: "/" focuses search, Esc clears selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelection(null);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!hasLoadedOnce && !snapshot) {
    return (
      <div className="boot-screen">
        <div className="spinner" />
        <div className="title">Amtrak Live Explorer</div>
        <div>{status.error ? `Error: ${status.error}` : 'Contacting rail data source…'}</div>
      </div>
    );
  }

  return (
    <div className="app-root" data-provider={mode}>
      <Header
        status={status}
        onRefresh={refresh}
        onToggleSidebar={mode === 'live' ? () => setSidebarOpen((v) => !v) : undefined}
        sidebarOpen={sidebarOpen}
      />
      <MapView
        snapshot={snapshot}
        filters={filters}
        selection={selection}
        onSelectTrain={onSelectTrain}
        onSelectStation={onSelectStation}
      />
      <Sidebar
        summary={summary}
        filters={filters}
        onFiltersChange={setFilters}
        routeNames={routeNames}
        filteredTrains={filteredTrains}
        onSelectTrain={onSelectTrain}
        onSelectStation={onSelectStation}
        selection={selection}
        query={searchQuery}
        onQueryChange={setQuery}
        searchResults={searchResults}
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {selectedTrain && (
        <TrainDetailPanel
          train={selectedTrain}
          stations={stations}
          onClose={() => setSelection(null)}
          onSelectStation={onSelectStation}
        />
      )}
      {selectedStation && (
        <StationDetailPanel
          station={selectedStation}
          trains={trains}
          onClose={() => setSelection(null)}
          onSelectTrain={onSelectTrain}
        />
      )}
    </div>
  );
}