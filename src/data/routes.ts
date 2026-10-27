/**
 * Display metadata for Amtrak service routes. The live-data provider gives a
 * route *name* per train but no official route geometry; the map corridor for a
 * route is drawn from its station sequence. Route names, slugs, and endpoints
 * here are curated from the Amtraker/Amtrak network vocabulary.
 */
export interface RouteMeta {
  /** Route name exactly as the provider emits it. */
  name: string;
  /** Stable slug used for filtering. */
  slug: string;
  /** City of the primary service terminus on one side. */
  endA: string;
  /** City of the primary service terminus on the other side. */
  endB: string;
  /** Family grouping for the filter list. */
  group: 'northeast' | 'long-distance' | 'state-corridor' | 'other';
}

const routes: RouteMeta[] = [
  { name: 'Acela', slug: 'acela', endA: 'Boston', endB: 'Washington', group: 'northeast' },
  { name: 'Northeast Regional', slug: 'northeast-regional', endA: 'Boston', endB: 'Virginia', group: 'northeast' },
  { name: 'Keystone', slug: 'keystone', endA: 'New York', endB: 'Harrisburg', group: 'northeast' },
  { name: 'Vermonter', slug: 'vermonter', endA: 'Washington', endB: 'St. Albans', group: 'northeast' },
  { name: 'Downeaster', slug: 'downeaster', endA: 'Boston', endB: 'Brunswick', group: 'northeast' },
  { name: 'Adirondack', slug: 'adirondack', endA: 'New York', endB: 'Montreal', group: 'northeast' },
  { name: 'Empire Service', slug: 'empire-service', endA: 'New York', endB: 'Niagara Falls', group: 'northeast' },
  { name: 'Carolinian', slug: 'carolinian', endA: 'New York', endB: 'Charlotte', group: 'northeast' },
  { name: 'Piedmont', slug: 'piedmont', endA: 'Charlotte', endB: 'Raleigh', group: 'northeast' },
  { name: 'Palmetto', slug: 'palmetto', endA: 'New York', endB: 'Savannah', group: 'northeast' },
  { name: 'Silver Meteor', slug: 'silver-meteor', endA: 'New York', endB: 'Miami', group: 'northeast' },
  { name: 'Floridian', slug: 'floridian', endA: 'Chicago', endB: 'Miami', group: 'long-distance' },
  { name: 'Auto Train', slug: 'auto-train', endA: 'Lorton', endB: 'Sanford', group: 'northeast' },
  { name: 'Crescent', slug: 'crescent', endA: 'New York', endB: 'New Orleans', group: 'long-distance' },
  { name: 'Lake Shore Limited', slug: 'lake-shore-limited', endA: 'Chicago', endB: 'New York', group: 'long-distance' },
  { name: 'Empire Builder', slug: 'empire-builder', endA: 'Chicago', endB: 'Seattle/Portland', group: 'long-distance' },
  { name: 'California Zephyr', slug: 'california-zephyr', endA: 'Chicago', endB: 'Emeryville', group: 'long-distance' },
  { name: 'Southwest Chief', slug: 'southwest-chief', endA: 'Chicago', endB: 'Los Angeles', group: 'long-distance' },
  { name: 'Coast Starlight', slug: 'coast-starlight', endA: 'Seattle', endB: 'Los Angeles', group: 'long-distance' },
  { name: 'Sunset Limited', slug: 'sunset-limited', endA: 'New Orleans', endB: 'Los Angeles', group: 'long-distance' },
  { name: 'Texas Eagle', slug: 'texas-eagle', endA: 'Chicago', endB: 'San Antonio', group: 'long-distance' },
  { name: 'City of New Orleans', slug: 'city-of-new-orleans', endA: 'Chicago', endB: 'New Orleans', group: 'long-distance' },
  { name: 'Heartland Flyer', slug: 'heartland-flyer', endA: 'Fort Worth', endB: 'Oklahoma City', group: 'state-corridor' },
  { name: 'Amtrak Cascades', slug: 'amtrak-cascades', endA: 'Vancouver', endB: 'Eugene', group: 'state-corridor' },
  { name: 'Pacific Surfliner', slug: 'pacific-surfliner', endA: 'San Diego', endB: 'San Luis Obispo', group: 'state-corridor' },
  { name: 'Capitol Corridor', slug: 'capitol-corridor', endA: 'San Jose', endB: 'Auburn', group: 'state-corridor' },
  { name: 'San Joaquins', slug: 'san-joaquins', endA: 'Sacramento', endB: 'Bakersfield', group: 'state-corridor' },
  { name: 'Hiawatha', slug: 'hiawatha', endA: 'Chicago', endB: 'Milwaukee', group: 'state-corridor' },
  { name: 'Wolverine', slug: 'wolverine', endA: 'Chicago', endB: 'Pontiac', group: 'state-corridor' },
  { name: 'Blue Water', slug: 'blue-water', endA: 'Chicago', endB: 'Port Huron', group: 'state-corridor' },
  { name: 'Illini', slug: 'illini', endA: 'Chicago', endB: 'Carbondale', group: 'state-corridor' },
  { name: 'Illinois Zephyr', slug: 'illinois-zephyr', endA: 'Chicago', endB: 'Quincy', group: 'state-corridor' },
  { name: 'Carl Sandburg', slug: 'carl-sandburg', endA: 'Chicago', endB: 'Quincy', group: 'state-corridor' },
  { name: 'Lincoln Service', slug: 'lincoln-service', endA: 'Chicago', endB: 'St. Louis', group: 'state-corridor' },
  { name: 'Missouri River Runner', slug: 'missouri-river-runner', endA: 'Kansas City', endB: 'St. Louis', group: 'state-corridor' },
  { name: 'Lincoln River Runner', slug: 'lincoln-river-runner', endA: 'Chicago', endB: 'Kansas City', group: 'state-corridor' },
];

const byName = new Map(routes.map((r) => [r.name.toLowerCase(), r]));
const bySlug = new Map(routes.map((r) => [r.slug, r]));

export function routeMeta(name: string): RouteMeta | undefined {
  return byName.get(name.toLowerCase());
}

export function routeMetaBySlug(slug: string): RouteMeta | undefined {
  return bySlug.get(slug);
}

export function routeSlug(name: string): string {
  return routeMeta(name)?.slug ?? defaultSlug(name);
}

/** Deterministic slug fallback for provider route names we do not curate. */
export function defaultSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}