import type { DigitizedDesign, ShapeLayer } from "./types";
import { expandPolyline } from "../stitchgen/running";
import { expandSatin } from "../stitchgen/satin";
import { expandTatami } from "../stitchgen/tatami";
import { writePesx, type PesxPath } from "../pen/pen";

export function expandLayer(layer: ShapeLayer): [number, number][] {
  const p = layer.params;
  switch (layer.stitchType) {
    case "running":
      return expandPolyline(layer.points, p.stitchLen ?? 2.5);
    case "satin":
      return expandSatin(layer.points, p.width ?? 2.0, p.stitchLen ?? 0.4);
    case "tatami":
      return expandTatami(
        layer.points,
        p.angleDeg ?? 0,
        p.rowSpacing ?? 0.4,
        p.stitchLen ?? 3.0,
      );
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

export function designToPesx(design: DigitizedDesign): string {
  const paths: PesxPath[] = design.layers.map((layer) => {
    const pts = expandLayer(layer);
    return {
      points: pts,
      threadcode: layer.thread.colorCode,
      chartcode: layer.thread.chartCode,
      color: hexToRgb(layer.thread.hex),
    };
  });
  return writePesx(paths, design.hoopMm[0], design.hoopMm[1]);
}
