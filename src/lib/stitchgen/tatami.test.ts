import { describe, it, expect } from "vitest";
import { expandTatami } from "./tatami";

describe("tatami stitch", () => {
  it("fills polygon", () => {
    const out = expandTatami([[0, 0], [10, 0], [10, 10], [0, 10]], 0, 1.0, 2.0);
    expect(out.length).toBeGreaterThan(20);
    const xs = out.map((p) => p[0]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1e-6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(10 + 1e-6);
  });
});
