import { describe, it, expect } from "vitest";
import { expandPolyline } from "./running";

describe("running stitch", () => {
  it("expandPolyline keeps endpoints and spacing", () => {
    const pts = expandPolyline([[0, 0], [10, 0]], 2.5);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[pts.length - 1]).toEqual([10, 0]);
    expect(pts.length).toBeGreaterThanOrEqual(3);
    expect(pts.length).toBeLessThanOrEqual(6);
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1][0] - pts[i][0];
      const dy = pts[i + 1][1] - pts[i][1];
      const sq = dx * dx + dy * dy;
      expect(sq).toBeGreaterThan(0);
      expect(sq).toBeLessThanOrEqual(2.6 * 2.6 + 1e-6);
    }
  });
});
