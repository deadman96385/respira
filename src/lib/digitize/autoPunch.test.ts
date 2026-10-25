import { describe, it, expect } from "vitest";
import { autoPunch, autoPunchDesign } from "./autoPunch";

describe("autoPunch", () => {
  it("traces a filled rectangle", () => {
    const w = 40, h = 30;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 5; y < 25; y++) {
      for (let x = 5; x < 35; x++) {
        const i = (y * w + x) * 4;
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
      }
    }
    const img = { width: w, height: h, data } as unknown as ImageData;
    const layers = autoPunch(img, { threshold: 128, simplifyEpsilon: 2 });
    expect(layers.length).toBeGreaterThanOrEqual(1);
    expect(layers[0].points.length).toBeGreaterThanOrEqual(3);
    expect(layers[0].closed).toBe(true);
  });

  it("autoPunchDesign returns a design", () => {
    const w = 20, h = 20;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4 + 3] = 255;
      data[i * 4] = 0; data[i * 4 + 1] = 0; data[i * 4 + 2] = 0;
    }
    const img = { width: w, height: h, data } as unknown as ImageData;
    const d = autoPunchDesign(img);
    expect(d.layers.length).toBeGreaterThanOrEqual(1);
    expect(d.hoopMm).toEqual([100, 100]);
  });
});
