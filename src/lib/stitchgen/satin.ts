// satin.ts — satin (zigzag) stitch expansion (TS port)
export type Point = [number, number];

export function expandSatin(centerline: Point[], width = 2.0, stitchLen = 0.4): Point[] {
  if (centerline.length < 2) return [...centerline];
  const samples: Point[] = [centerline[0]];
  for (let i = 0; i < centerline.length - 1; i++) {
    const a = centerline[i], b = centerline[i + 1];
    const n = Math.max(1, Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / stitchLen));
    for (let j = 1; j <= n; j++) {
      const t = j / n;
      samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  const half = width / 2;
  const out: Point[] = [];
  let side = 1;
  for (let i = 0; i < samples.length - 1; i++) {
    const p = samples[i];
    const dx = samples[i + 1][0] - p[0], dy = samples[i + 1][1] - p[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    out.push([p[0] + side * half * nx, p[1] + side * half * ny]);
    side = -side;
  }
  const p = samples[samples.length - 1];
  const dx = samples[samples.length - 1][0] - samples[samples.length - 2][0];
  const dy = samples[samples.length - 1][1] - samples[samples.length - 2][1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  out.push([p[0] + side * half * nx, p[1] + side * half * ny]);
  return out;
}
