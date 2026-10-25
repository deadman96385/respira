import type { PesPatternData } from "../../formats/import/client";
import { decodePenData } from "../../formats/pen/decoder";
import { STITCH } from "../../formats/import/constants";
import { encode } from "../pen/pen";
import { designToPesx, expandLayer } from "./designToPesx";
import type { DigitizedDesign } from "./types";

export function designToPattern(design: DigitizedDesign): PesPatternData {
  const pesx = designToPesx(design);

  // Build stitches (0.1mm units) from expanded layer points.
  const stitches: number[][] = [];
  const threads: PesPatternData["threads"] = [];
  design.layers.forEach((layer, layerIndex) => {
    const pts = expandLayer(layer);
    for (const [x, y] of pts) {
      stitches.push([Math.round(x * 10), Math.round(y * 10), STITCH, layerIndex]);
    }
    threads.push({
      color: 0,
      hex: layer.thread.hex,
      brand: null,
      catalogNumber: layer.thread.colorCode,
      description: null,
      chart: layer.thread.colorCode,
    });
  });

  // Bounds (0.1mm units).
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of stitches) {
    if (!isFinite(s[0])) continue;
    minX = Math.min(minX, s[0]);
    maxX = Math.max(maxX, s[0]);
    minY = Math.min(minY, s[1]);
    maxY = Math.max(maxY, s[1]);
  }
  if (!isFinite(minX)) minX = maxX = minY = maxY = 0;

  const penResult = encode(pesx);
  const penData = penResult.stream;
  const penStitches = decodePenData(penData);

  // Unique colors (dedup by hex), mirroring worker.ts.
  const uniqueColors = threads.reduce<PesPatternData["uniqueColors"]>(
    (acc, thread, idx) => {
      const existing = acc.find((c) => c.hex === thread.hex);
      if (existing) {
        existing.threadIndices.push(idx);
      } else {
        acc.push({
          color: thread.color,
          hex: thread.hex,
          brand: thread.brand,
          catalogNumber: thread.catalogNumber,
          description: thread.description,
          chart: thread.chart,
          threadIndices: [idx],
        });
      }
      return acc;
    },
    [],
  );

  return {
    stitches,
    threads,
    uniqueColors,
    penData,
    penStitches,
    colorCount: uniqueColors.length,
    stitchCount: stitches.length,
    bounds: { minX, maxX, minY, maxY },
  };
}
