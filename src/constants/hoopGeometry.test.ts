import { describe, expect, it } from "vitest";
import {
  MARKERS,
  classifyMarkerSide,
  markerCentersForSize,
  markersForSize,
} from "./hoopGeometry";

describe("hoop marker geometry", () => {
  it("keeps the measured standard-hoop marker centers", () => {
    expect(markerCentersForSize("100")).toEqual({
      top: { x: -347.5, y: -767.5 },
      right: { x: 767.5, y: -347.5 },
      bottom: { x: 347.5, y: 767.5 },
      left: { x: -767.5, y: 347.5 },
    });
    expect(markersForSize("100")).toBe(MARKERS);
  });

  it("places 70mm markers closer to the center, on the right sides", () => {
    for (const m of markersForSize("70")) {
      const standard = MARKERS.find((s) => s.side === m.side)!;
      expect(Math.hypot(m.center.x, m.center.y)).toBeLessThan(
        Math.hypot(standard.center.x, standard.center.y),
      );
      expect(classifyMarkerSide(m.center.x, m.center.y)).toBe(m.side);
    }
  });
});
