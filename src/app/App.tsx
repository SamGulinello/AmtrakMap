import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProvider, type ProviderMode } from '../data';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { DataNotice } from './DataNotice';
import { SEARCH_INPUT_ID } from './Sidebar';
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
  // Bumped when the "/" shortcut asks for the search field. Focusing inside the
  // key handler would run before the drawer has rendered open on narrow screens.
  const [searchFocusRequest, setSearchFocusRequest] = useState(0);
  const online = useOnlineStatus();

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
        return;
      }
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (typing) return;
      if (!document.getElementById(SEARCH_INPUT_ID)) return;
      e.preventDefault();
      setSidebarOpen(true);
      setSearchFocusRequest((n) => n + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (searchFocusRequest === 0) return;
    document.getElementById(SEARCH_INPUT_ID)?.focus();
  }, [searchFocusRequest, sidebarOpen]);

  if (!hasLoadedOnce && !snapshot) {
    // A hard failure here means even the snapshot fallback could not load, so
    // stop pretending to be busy and say what happened.
    if (status.error) {
      return (
        <div className="boot-screen" data-testid="boot-error">
          <div className="title">Amtrak Live Explorer</div>
          <div role="alert" className="boot-error-message">
            The rail data could not be loaded. {status.error}
          </div>
          <button className="btn" onClick={() => void refresh()} data-testid="boot-retry">
            Try again
          </button>
        </div>
      );
    }
    return (
      <div className="boot-screen" data-testid="boot-loading">
        <div className="spinner" />
        <div className="title">Amtrak Live Explorer</div>
        <div>Contacting rail data source…</div>
      </div>
    );
  }

  return (
    <div className="app-root" data-provider={mode}>
      <Header
        status={status}
        onRefresh={refresh}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
      />
      <MapView
        snapshot={snapshot}
        filters={filters}
        selection={selection}
        onSelectTrain={onSelectTrain}
        onSelectStation={onSelectStation}
      />
      <DataNotice offline={!online} error={status.ok ? undefined : status.error} />
      <Sidebar
        summary={summary}
        status={status}
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