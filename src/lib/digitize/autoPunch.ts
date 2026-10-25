// autoPunch.ts — clean-room bitmap -> outline tracer (first pass).
// Converts an ImageData into ShapeLayer[] by thresholding + contour extraction.
// This is a baseline implementation; Brother's auto-punch also does color
// reduction, region segmentation, underlay and stitch-type heuristics (TODO).

import type { ShapeLayer, DigitizedDesign } from "./types";

export interface AutoPunchOptions {
  threshold?: number; // 0..255 luminance threshold
  simplifyEpsilon?: number; // Douglas-Peucker epsilon in px
  stitchType?: ShapeLayer["stitchType"];
  thread?: ShapeLayer["thread"];
  pixelsPerMm?: number; // scale from px to mm
  hoopMm?: [number, number];
}

const DEFAULT_THREAD: ShapeLayer["thread"] = {
  hex: "#000000",
  colorCode: "900",
  chartCode: 13,
};

// --- helpers ---

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function thresholdImage(img: ImageData, threshold: number): Uint8Array {
  const { width, height, data } = img;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    out[i] = a > 127 && luminance(r, g, b) < threshold ? 1 : 0;
  }
  return out;
}

function idx(x: number, y: number, w: number): number {
  return y * w + x;
}

// Moore-neighbor contour tracing for a single connected component starting
// from the first foreground pixel found in scan order.
function traceContour(bin: Uint8Array, w: number, h: number): [number, number][] | null {
  // find start
  let sx = -1, sy = -1;
  outer: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bin[idx(x, y, w)] === 1) {
        // ensure it's a boundary pixel (has a 0 neighbor)
        const neighbors = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || bin[idx(nx, ny, w)] === 0) {
            sx = x; sy = y; break outer;
          }
        }
      }
    }
  }
  if (sx < 0) return null;

  // Simple boundary follow: walk clockwise keeping foreground on right.
  const pts: [number, number][] = [];
  let x = sx, y = sy;
  const dirs: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  let dir = 0;
  let steps = 0;
  const maxSteps = w * h * 4;
  do {
    pts.push([x, y]);
    // find next boundary pixel
    let found = false;
    for (let i = 0; i < 8; i++) {
      const d = (dir + i) % 8;
      const nx = x + dirs[d][0];
      const ny = y + dirs[d][1];
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && bin[idx(nx, ny, w)] === 1) {
        // check that it's boundary-ish; accept
        x = nx; y = ny; dir = (d + 6) % 8; found = true; break;
      }
    }
    if (!found) break;
    steps++;
  } while (!(x === sx && y === sy) && steps < maxSteps);

  if (pts.length < 3) return null;
  return pts;
}

function douglasPeucker(points: [number, number][], eps: number): [number, number][] {
  if (points.length <= 2) return points.slice();
  // find point with max distance from line first-last
  const first = points[0];
  const last = points[points.length - 1];
  let maxD = 0, maxI = 0;
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const d = Math.abs((points[i][0] - first[0]) * dy - (points[i][1] - first[1]) * dx) / len;
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > eps) {
    const left = douglasPeucker(points.slice(0, maxI + 1), eps);
    const right = douglasPeucker(points.slice(maxI), eps);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

export function autoPunch(img: ImageData, opts: AutoPunchOptions = {}): ShapeLayer[] {
  const threshold = opts.threshold ?? 128;
  const eps = opts.simplifyEpsilon ?? 1.5;
  const stitchType = opts.stitchType ?? "tatami";
  const thread = opts.thread ?? DEFAULT_THREAD;
  const ppm = opts.pixelsPerMm ?? 10; // 10 px per mm default
  const hoop = opts.hoopMm ?? [100, 100];

  const bin = thresholdImage(img, threshold);
  const contour = traceContour(bin, img.width, img.height);
  if (!contour) return [];

  const simplified = douglasPeucker(contour, eps);
  // convert px -> mm, centered
  const cx = img.width / 2;
  const cy = img.height / 2;
  const pts: [number, number][] = simplified.map(([px, py]) => [
    (px - cx) / ppm,
    (py - cy) / ppm,
  ]);

  const layer: ShapeLayer = {
    id: `ap-${Date.now()}`,
    points: pts,
    stitchType,
    params: stitchType === "tatami" ? { angleDeg: 0, rowSpacing: 0.4, stitchLen: 3.0 } : {},
    thread,
    closed: true,
  };

  const design: DigitizedDesign = { layers: [layer], hoopMm: hoop };
  void design;
  return [layer];
}

// Convenience: build a full design from an image.
export function autoPunchDesign(img: ImageData, opts: AutoPunchOptions = {}): DigitizedDesign {
  const hoop = opts.hoopMm ?? [100, 100];
  return { layers: autoPunch(img, opts), hoopMm: hoop };
}
