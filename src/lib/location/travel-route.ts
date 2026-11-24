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
  maximumSpeedMetersPerSecond: positiveNumber(process.env.TRAVEL_MAX_SPEED_METERS_PER_SECOND, 100 / 3.6),
  maximumGapMs: positiveNumber(process.env.TRAVEL_MAX_GAP_MINUTES, 15) * 60_000,
  minimumMovementMeters: positiveNumber(process.env.TRAVEL_MIN_MOVEMENT_METERS, 5),
  uncertaintyFactor: positiveNumber(process.env.TRAVEL_ACCURACY_UNCERTAINTY_FACTOR, 1),
  minimumSpikeLegMeters: positiveNumber(process.env.TRAVEL_MIN_SPIKE_LEG_METERS, 100),
});

export function cleanedTravelRouteSegments<T extends TravelRoutePoint>(points: T[]): T[][] {
  const ordered = [...points].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const segments: T[][] = [];
  for (const point of ordered) {
    const current = segments[segments.length - 1];
    if (!current || point.capturedAt.getTime() - current[current.length - 1].capturedAt.getTime() > TRAVEL_ROUTE_CONFIG.maximumGapMs) segments.push([point]);
    else current.push(point);
  }
  return segments.flatMap(segment => {
    const route = cleanSegment(segment);
    return route.length ? [smoothTravelRoute(route)] : [];
  });
}

/** Conservative local smoothing: only adjust noisy interior fixes on near-straight legs. */
function smoothTravelRoute<T extends TravelRoutePoint>(route: T[]): T[] {
  return route.map((point, index) => {
    if (index === 0 || index === route.length - 1 || (point.accuracyMeters ?? 0) <= 10) return point;
    const before = route[index - 1], after = route[index + 1];
    const left = point.capturedAt.getTime() - before.capturedAt.getTime();
    const right = after.capturedAt.getTime() - point.capturedAt.getTime();
    if (left <= 0 || right <= 0 || left > 60000 || right > 60000) return point;
    const legs = haversineDistanceMeters(before, point) + haversineDistanceMeters(point, after);
    if (legs <= 0 || haversineDistanceMeters(before, after) < legs * 0.98) return point;
    const fraction = left / (left + right);
    const estimate = {latitude: before.latitude + (after.latitude - before.latitude) * fraction,
      longitude: before.longitude + (after.longitude - before.longitude) * fraction};
    if (Math.abs(after.longitude - before.longitude) > 180 || haversineDistanceMeters(point, estimate) > (point.accuracyMeters ?? 0)) return point;
    const weight = Math.min(0.25, (point.accuracyMeters ?? 0) / 200);
    return {...point, latitude: point.latitude + (estimate.latitude - point.latitude) * weight,
      longitude: point.longitude + (estimate.longitude - point.longitude) * weight};
  });
}

export function cleanedTravelRoute<T extends TravelRoutePoint>(points: T[]): T[] {
  return cleanedTravelRouteSegments(points).flat();
}

function cleanSegment<T extends TravelRoutePoint>(points: T[]): T[] {
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
      && (point.accuracyMeters ?? 0) > Math.max(previous.accuracyMeters ?? 0, next.accuracyMeters ?? 0) * 2
      && haversineDistanceMeters(previous, point) >= TRAVEL_ROUTE_CONFIG.minimumSpikeLegMeters
      && haversineDistanceMeters(point, next) >= TRAVEL_ROUTE_CONFIG.minimumSpikeLegMeters);
  });
  if (!usable.length) return [];

  const route: T[] = [usable[0]];
  let anchor = usable[0];
  let lastStationaryFix = anchor;
  for (let index = 1; index < usable.length; index += 1) {
    const point = usable[index];
    const elapsedMs = point.capturedAt.getTime() - lastStationaryFix.capturedAt.getTime();
    if (elapsedMs <= 0) continue;

    const distance = haversineDistanceMeters(anchor, point);
    const uncertainty = Math.max(
      TRAVEL_ROUTE_CONFIG.minimumMovementMeters,
      ((anchor.accuracyMeters ?? 0) + (point.accuracyMeters ?? 0)) * TRAVEL_ROUTE_CONFIG.uncertaintyFactor,
    );
    if (distance <= uncertainty) {
      lastStationaryFix = point;
      continue;
    }
    // Suppress a low-confidence departure from a stationary cluster only when
    // the following independent fix returns to the anchor uncertainty region.
    const following = usable[index + 1];
    if (following) {
      const seconds = (following.capturedAt.getTime() - point.capturedAt.getTime()) / 1000;
      const returnRadius = Math.max(TRAVEL_ROUTE_CONFIG.minimumMovementMeters, (anchor.accuracyMeters ?? 0) + (following.accuracyMeters ?? 0));
      if (seconds > 0 && seconds <= 90 && distance <= 80
        && (point.accuracyMeters ?? 0) > 2 * Math.max(anchor.accuracyMeters ?? 0, following.accuracyMeters ?? 0)
        && haversineDistanceMeters(anchor, following) <= returnRadius) continue;
    }
    if (distance / (elapsedMs / 1000) > TRAVEL_ROUTE_CONFIG.maximumSpeedMetersPerSecond) {
      const next = usable[index + 1];
      const nextSeconds = next ? (next.capturedAt.getTime() - point.capturedAt.getTime()) / 1000 : 0;
      // Require an independent, accurate onward fix consistent with the high-speed leg.
      if (!next || nextSeconds <= 0 || nextSeconds > 120
        || (point.accuracyMeters ?? Infinity) > 20
        || (anchor.accuracyMeters ?? Infinity) > 20
        || (next.accuracyMeters ?? Infinity) > 20) continue;
      const onward = haversineDistanceMeters(point, next);
      const direct = haversineDistanceMeters(anchor, next);
      const speed = distance / (elapsedMs / 1000);
      const onwardSpeed = onward / nextSeconds;
      if (onwardSpeed < speed * 0.5 || onwardSpeed > speed * 1.5
        || direct < (distance + onward) * 0.8) continue;
    }
    route.push(point);
    anchor = point;
    lastStationaryFix = point;
  }
  return route;
}

export function calculateTravelDistanceMeters(points: TravelRoutePoint[]): number {
  let total = 0;
  for (const route of cleanedTravelRouteSegments(points)) {
    for (let index = 1; index < route.length; index += 1) {
      total += haversineDistanceMeters(route[index - 1], route[index]);
    }
  }
  return total;
}

/**
 * Calculates each attendance session independently, then adds the session totals.
 * No distance is ever created between the last GPS point of one attendance session
 * and the first GPS point of a later session.
 */
export function calculateTravelDistanceBySession(sessions: TravelRoutePoint[][]) {
  const sessionDistanceMeters = sessions.map(session => calculateTravelDistanceMeters(session));
  return {
    sessionDistanceMeters,
    totalDistanceMeters: sessionDistanceMeters.reduce((total, distance) => total + distance, 0),
  };
}
