import { describe, it, expect } from "vitest";
import { designToPattern } from "./designToPattern";
import type { DigitizedDesign } from "./types";

describe("designToPattern", () => {
  it("produces PesPatternData with pen bytes", () => {
    const design: DigitizedDesign = {
      hoopMm: [40, 40],
      layers: [
        {
          id: "l1",
          points: [[5, 5], [25, 5], [25, 25]],
          stitchType: "running",
          params: { stitchLen: 2.0 },
          thread: { hex: "#FF0000", colorCode: "001", chartCode: 13 },
          closed: false,
        },
      ],
    };
    const data = designToPattern(design);
    expect(data.stitches.length).toBeGreaterThan(0);
    expect(data.penData.length).toBeGreaterThan(0);
    expect(data.penData.length % 4).toBe(0);
    expect(data.penStitches.stitches.length).toBeGreaterThan(0);
    expect(data.bounds.minX).toBeLessThanOrEqual(data.bounds.maxX);
    expect(data.colorCount).toBe(1);
  });
});
