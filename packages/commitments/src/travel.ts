import type { LatLng, Place } from "@cinch/shared";

const WALK_MPS = 1.4;
const CAMPUS_DRIVE_MPS = 8.2;
const DRIVE_AFTER_M = 1800;
const BUFFER_SECONDS = 90;

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function travelSeconds(from: LatLng, to: LatLng): number {
  const meters = haversineM(from, to);
  const speed = meters > DRIVE_AFTER_M ? CAMPUS_DRIVE_MPS : WALK_MPS;
  return Math.round(meters / speed) + BUFFER_SECONDS;
}

export function leaveByAt(input: {
  now: Date;
  deadline: Date;
  from: LatLng;
  place: Place;
}): { leaveAt: Date; minutes: number; meters: number; alreadyLate: boolean } {
  const meters = Math.round(haversineM(input.from, { lat: input.place.lat, lng: input.place.lng }));
  const seconds = travelSeconds(input.from, { lat: input.place.lat, lng: input.place.lng });
  const leaveAt = new Date(input.deadline.getTime() - seconds * 1000);
  const minutes = Math.max(0, Math.round((leaveAt.getTime() - input.now.getTime()) / 60_000));
  return {
    leaveAt,
    minutes,
    meters,
    alreadyLate: leaveAt.getTime() <= input.now.getTime(),
  };
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
