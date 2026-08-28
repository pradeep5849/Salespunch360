import { describe, expect, it } from "vitest";
import { calculateRouteDistanceMeters, haversineDistanceMeters } from "./geo";

describe("route distance foundation", () => {
  it("calculates zero distance for identical points", () => {
    expect(haversineDistanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
  });

  it("sums consecutive route segments deterministically", () => {
    const distance = calculateRouteDistanceMeters([{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 }, { latitude: 0, longitude: 0.002 }]);
    expect(distance).toBeGreaterThan(220);
    expect(distance).toBeLessThan(225);
  });
});
