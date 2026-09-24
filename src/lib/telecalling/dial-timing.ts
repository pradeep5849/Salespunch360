const DIAL_TIMING_SOURCES = ["PWA_VISIBILITY", "ANDROID_RESUME"] as const;

export type DialTimingSource = (typeof DIAL_TIMING_SOURCES)[number];

export type NormalizedDialTiming = {
  dialStartedAt: Date | null;
  dialEndedAt: Date | null;
  dialDurationSeconds: number | null;
  timingSource: DialTimingSource | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDialTiming(input: {
  dialStartedAt?: unknown;
  dialEndedAt?: unknown;
  timingSource?: unknown;
}): NormalizedDialTiming {
  const startRaw = text(input.dialStartedAt);
  const endRaw = text(input.dialEndedAt);
  const sourceRaw = text(input.timingSource);

  if (!startRaw && !endRaw && !sourceRaw) {
    return {
      dialStartedAt: null,
      dialEndedAt: null,
      dialDurationSeconds: null,
      timingSource: null,
    };
  }

  if (!startRaw || !endRaw || !(DIAL_TIMING_SOURCES as readonly string[]).includes(sourceRaw)) {
    throw new Error("INVALID_INPUT");
  }

  const dialStartedAt = new Date(startRaw);
  const dialEndedAt = new Date(endRaw);
  if (!Number.isFinite(dialStartedAt.getTime()) || !Number.isFinite(dialEndedAt.getTime())) {
    throw new Error("INVALID_DATE");
  }

  const dialDurationSeconds = Math.max(
    0,
    Math.round((dialEndedAt.getTime() - dialStartedAt.getTime()) / 1000),
  );
  if (dialEndedAt.getTime() < dialStartedAt.getTime() || dialDurationSeconds > 86_400) {
    throw new Error("INVALID_INPUT");
  }

  return {
    dialStartedAt,
    dialEndedAt,
    dialDurationSeconds,
    timingSource: sourceRaw as DialTimingSource,
  };
}
