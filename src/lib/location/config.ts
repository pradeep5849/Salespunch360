export const LOCATION_CONFIG = Object.freeze({
  watchMaximumAgeMs: 10_000,
  watchTimeoutMs: 20_000,
  minimumAcceptedIntervalMs: 15_000,
  minimumMovementMeters: 10,
  maximumAccuracyMeters: 10_000,
  maximumCaptureAgeMs: 24 * 60 * 60 * 1_000,
  maximumFutureSkewMs: 5 * 60 * 1_000,
});
