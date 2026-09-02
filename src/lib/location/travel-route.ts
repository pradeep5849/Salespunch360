import { haversineDistanceMeters } from "./geo";

export type TravelRoutePoint = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: Date;
  sequenceNumber?: number;
  id?: string;
};

const positiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Quality limits used only for reported travel, never for point storage or geofences. */
export const TRAVEL_ROUTE_CONFIG = Object.freeze({
  maximumAccuracyMeters: positiveNumber(process.env.TRAVEL_MAX_ACCURACY_METERS, 50),
  maximumSpeedMetersPerSecond: positiveNumber(process.env.TRAVEL_MAX_SPEED_METERS_PER_SECOND, 55),
  maximumGapMs: positiveNumber(process.env.TRAVEL_MAX_GAP_MINUTES, 30) * 60_000,
  minimumMovementMeters: positiveNumber(process.env.TRAVEL_MIN_MOVEMENT_METERS, 5),
  uncertaintyFactor: positiveNumber(process.env.TRAVEL_ACCURACY_UNCERTAINTY_FACTOR, 1),
  minimumSpikeLegMeters: positiveNumber(process.env.TRAVEL_MIN_SPIKE_LEG_METERS, 100),
});

export function cleanedTravelRoute<T extends TravelRoutePoint>(points: T[]): T[] {
  const ordered = [...points].sort((a, b) =>
    a.capturedAt.getTime() - b.capturedAt.getTime()
    || (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0)
    || (a.id ?? "").localeCompare(b.id ?? ""));
  const qualityPoints = ordered.filter(point => point.accuracyMeters != null
    && point.accuracyMeters >= 0
    && point.accuracyMeters <= TRAVEL_ROUTE_CONFIG.maximumAccuracyMeters);
  const usable = qualityPoints.filter((point, index) => {
    if (index === 0 || index === qualityPoints.length - 1) return true;
    const previous = qualityPoints[index - 1], next = qualityPoints[index + 1];
    const beforeMs = point.capturedAt.getTime() - previous.capturedAt.getTime();
    const afterMs = next.capturedAt.getTime() - point.capturedAt.getTime();
    if (beforeMs <= 0 || afterMs <= 0 || beforeMs > TRAVEL_ROUTE_CONFIG.maximumGapMs || afterMs > TRAVEL_ROUTE_CONFIG.maximumGapMs) return true;
    const endpointUncertainty = Math.max(TRAVEL_ROUTE_CONFIG.minimumMovementMeters, ((previous.accuracyMeters ?? 0) + (next.accuracyMeters ?? 0)) * TRAVEL_ROUTE_CONFIG.uncertaintyFactor);
    return !(haversineDistanceMeters(previous, next) <= endpointUncertainty
      && haversineDistanceMeters(previous, point) >= TRAVEL_ROUTE_CONFIG.minimumSpikeLegMeters
      && haversineDistanceMeters(point, next) >= TRAVEL_ROUTE_CONFIG.minimumSpikeLegMeters);
  });
  if (!usable.length) return [];

  const route: T[] = [usable[0]];
  let anchor = usable[0];
  for (const point of usable.slice(1)) {
    const elapsedMs = point.capturedAt.getTime() - anchor.capturedAt.getTime();
    if (elapsedMs <= 0) continue;
    if (elapsedMs > TRAVEL_ROUTE_CONFIG.maximumGapMs) {
      route.push(point);
      anchor = point;
      continue;
    }
    const distance = haversineDistanceMeters(anchor, point);
    const uncertainty = Math.max(
      TRAVEL_ROUTE_CONFIG.minimumMovementMeters,
      ((anchor.accuracyMeters ?? 0) + (point.accuracyMeters ?? 0)) * TRAVEL_ROUTE_CONFIG.uncertaintyFactor,
    );
    if (distance <= uncertainty) continue;
    if (distance / (elapsedMs / 1000) > TRAVEL_ROUTE_CONFIG.maximumSpeedMetersPerSecond) continue;
    route.push(point);
    anchor = point;
  }
  return route;
}

export function calculateTravelDistanceMeters(points: TravelRoutePoint[]): number {
  const route = cleanedTravelRoute(points);
  let total = 0;
  for (let index = 1; index < route.length; index += 1) {
    const elapsedMs = route[index].capturedAt.getTime() - route[index - 1].capturedAt.getTime();
    if (elapsedMs > 0 && elapsedMs <= TRAVEL_ROUTE_CONFIG.maximumGapMs) {
      total += haversineDistanceMeters(route[index - 1], route[index]);
    }
  }
  return total;
}
