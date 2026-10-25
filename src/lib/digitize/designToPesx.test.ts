import { describe, it, expect } from "vitest";
import { designToPesx } from "./designToPesx";
import type { DigitizedDesign } from "./types";

describe("designToPesx", () => {
  it("emits pesx for a running-stitch layer", () => {
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
    const out = designToPesx(design);
    expect(out).toContain("x-bilemb-pesxversion");
    expect(out).toContain('x-bilemb-threadcode="001"');
    expect(out).toContain('x-bilemb-chartcode="13"');
  });

  it("emits multiple layers", () => {
    const design: DigitizedDesign = {
      hoopMm: [40, 40],
      layers: [
        {
          id: "a",
          points: [[0, 0], [10, 0]],
          stitchType: "running",
          params: {},
          thread: { hex: "#000000", colorCode: "900", chartCode: 13 },
          closed: false,
        },
        {
          id: "b",
          points: [[0, 0], [10, 0], [10, 10], [0, 10]],
          stitchType: "tatami",
          params: {},
          thread: { hex: "#0000FF", colorCode: "405", chartCode: 13 },
          closed: true,
        },
      ],
    };
    const out = designToPesx(design);
    // two paths
    const pathCount = (out.match(/<path /g) || []).length;
    expect(pathCount).toBe(2);
  });
});
