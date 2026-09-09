import type { Place, PlaceProvider } from "@cinch/shared";

export const SEED_PLACES: Place[] = [
  { id: "plc_gym", name: "the gym", lat: 40.758, lng: -73.985, radiusM: 120, source: "seeded" },
  { id: "plc_home", name: "home", lat: 40.73, lng: -73.99, radiusM: 80, source: "seeded" },
  { id: "plc_library", name: "the library", lat: 40.753, lng: -73.982, radiusM: 80, source: "seeded" },
  { id: "plc_office", name: "the office", lat: 40.75, lng: -73.99, radiusM: 90, source: "seeded" },
];

/** @deprecated generic seeds — kept so older imports compile */
export const BABSON_PLACES = SEED_PLACES;

export function createSeededPlaceProvider(extra: Place[] = []): PlaceProvider {
  const all = [...SEED_PLACES, ...extra];
  return {
    async search(q) {
      const needle = q.toLowerCase();
      return all.filter((p) => p.name.toLowerCase().includes(needle));
    },
    async byId(id) {
      return all.find((p) => p.id === id) ?? null;
    },
  };
}
