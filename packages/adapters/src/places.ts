import type { Place, PlaceProvider } from "@cinch/shared";

export const BABSON_PLACES: Place[] = [
  { id: "plc_rec", name: "Babson Recreation Center", lat: 42.296, lng: -71.266, radiusM: 120, source: "seeded" },
  { id: "plc_lib", name: "Horn Library", lat: 42.298, lng: -71.266, radiusM: 80, source: "seeded" },
  { id: "plc_dining", name: "Trim Dining Hall", lat: 42.297, lng: -71.264, radiusM: 80, source: "seeded" },
  { id: "plc_rec2", name: "Reynolds Campus Center", lat: 42.2975, lng: -71.265, radiusM: 90, source: "seeded" },
  { id: "plc_dorm", name: "Forest Hall", lat: 42.299, lng: -71.263, radiusM: 70, source: "seeded" },
];

export function createSeededPlaceProvider(extra: Place[] = []): PlaceProvider {
  const all = [...BABSON_PLACES, ...extra];
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
