import { haversineDistance } from './geo';

/** Normalizes a place name for duplicate detection (case/punctuation-insensitive). */
export function normalizePlaceName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Collapses places that represent the same physical location but exist as
 * separate DB rows (duplicate imports with distinct slugs/ids).
 */
export function dedupePlacesByLocation<T extends {
  id?: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
}>(
  places: T[],
  /** Default 1km — catches OSM/Wikimedia re-imports with slightly different coords/city labels. */
  radiusKm = 1.0,
): T[] {
  const groups: { key: string; lat: number; lng: number; items: T[] }[] = [];

  for (const place of places) {
    if (place.latitude === null || place.longitude === null) continue;
    const key = normalizePlaceName(place.name);
    const match = groups.find(
      (g) => g.key === key && haversineDistance(g.lat, g.lng, place.latitude as number, place.longitude as number) / 1000 < radiusKm,
    );
    if (match) {
      match.items.push(place);
    } else {
      groups.push({ key, lat: place.latitude, lng: place.longitude, items: [place] });
    }
  }

  return groups.map((g) => g.items.reduce((best, cur) => ((cur.rating ?? 0) > (best.rating ?? 0) ? cur : best)));
}

export function dedupeByLocation<T extends {
  name: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
}>(places: T[]): T[] {
  return dedupePlacesByLocation(places);
}
