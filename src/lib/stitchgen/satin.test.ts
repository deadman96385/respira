import { describe, it, expect } from "vitest";
import { expandSatin } from "./satin";

describe("satin stitch", () => {
  it("produces zigzag with both sides", () => {
    const out = expandSatin([[0, 0], [20, 0]], 4.0, 1.0);
    expect(out.length).toBeGreaterThanOrEqual(10);
    const ys = out.map((p) => p[1]);
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...ys)).toBeGreaterThan(0);
  });
});
