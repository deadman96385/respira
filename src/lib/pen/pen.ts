// pen.ts — Brother PP1 "pen" stitch stream encoder (TypeScript port).

export const MM_TO_UNI = 10.0;
export const JUMP_LEN = 50;
export const MIN_SEG = 7;
export const TIE_LEN = 8;
export const TIE_WINDOW = 8.0;

export const FLAG_CMD = 0x01;
export const FLAG_COLOR = 0x02;
export const FLAG_END = 0x04;
export const FLAG_FEED = 0x01;
export const FLAG_CUT = 0x02;

export interface StitchPoint { x: number; y: number; xflags: number; yflags: number; }

export interface EncodeResult {
  stream: Uint8Array;
  colorNum: number[];
  widthHalf: number;
  heightHalf: number;
  records: StitchPoint[];
}

const WIDTH_RE = /width\s*=\s*"([^"]+)"/;
const HEIGHT_RE = /height\s*=\s*"([^"]+)"/;
const PATH_RE = /<path[^>]*?\bd\s*=\s*"([^"]*)"/gs;
const TOKEN_RE = /[MLCZmlcz]|-?\d*\.?\d+/g;

function halfExtents(pesx: string): [number, number] {
  const wb = pesx.match(WIDTH_RE);
  const hb = pesx.match(HEIGHT_RE);
  function conv(m: RegExpMatchArray | null): number {
    if (!m) return 0;
    let t = m[1].trim();
    if (t.endsWith("mm")) t = t.slice(0, -2);
    return parseFloat(t) * MM_TO_UNI * 0.5;
  }
  return [conv(wb), conv(hb)];
}

function pathDs(pesx: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  PATH_RE.lastIndex = 0;
  while ((m = PATH_RE.exec(pesx)) !== null) out.push(m[1]);
  return out;
}

interface TokenGroup { cmd: string; nums: number[]; }

function* tokens(d: string): Generator<TokenGroup> {
  const toks = d.match(TOKEN_RE) || [];
  let cmd = "m";
  let acc: number[] = [];
  for (const tok of toks) {
    if ("mlczMLCZ".includes(tok)) {
      if (acc.length) yield { cmd, nums: acc };
      cmd = tok.toLowerCase();
      acc = [];
    } else {
      const v = parseFloat(tok);
      if (!Number.isNaN(v)) acc.push(v);
    }
  }
  if (acc.length) yield { cmd, nums: acc };
}

function tiePairs(slots: number[], at: number): void {
  let dx = 0, dy = 0, total = 0;
  for (let k = 0; k < 4; k++) {
    const px = slots[at + 2 * k];
    const py = slots[at + 2 * k + 1];
    total += Math.hypot(px, py);
    if (total >= TIE_WINDOW) { dx = px; dy = py; break; }
    dx += px; dy += py;
  }
  const L = Math.hypot(dx, dy);
  const sx = L ? dx * TIE_LEN / L : TIE_LEN;
  const sy = L ? dy * TIE_LEN / L : 0;
  const ix = Math.trunc(sx), iy = Math.trunc(sy);
  const vals = [ix, iy, -ix, -iy, ix, iy, -ix, -iy];
  for (let i = 0; i < 8; i++) slots[at + i] = vals[i];
}

export function encode(pesx: string): EncodeResult {
  const [wh, hh] = halfExtents(pesx);
  const paths = pathDs(pesx);
  if (paths.length === 0) {
    return { stream: new Uint8Array(0), colorNum: [], widthHalf: wh, heightHalf: hh, records: [] };
  }

  const slots: number[] = [];
  const colorSlots: number[] = [];
  const feedSlots = new Set<number>();
  const cutSlots = new Set<number>();
  const tieBases: number[] = [];

  for (let ci = 0; ci < paths.length; ci++) {
    if (ci > 0) colorSlots.push(slots.length);

    let firstPairWritten = false;
    for (const { cmd, nums } of tokens(paths[ci])) {
      const it = nums[Symbol.iterator]();
      for (let nx = it.next(); !nx.done; nx = it.next()) {
        const ny = it.next();
        if (ny.done) break;
        const dx = nx.value * MM_TO_UNI;
        const dy = ny.value * MM_TO_UNI;
        const seg = Math.hypot(dx, dy);
        if (cmd === "m" && !firstPairWritten && ci === 0) {
          if (dx === 0 && dy === 0) continue;
          tieBases.push(slots.length);
          feedSlots.add(slots.length);
          cutSlots.add(slots.length);
          slots.push(dx, dy);
          firstPairWritten = true;
          continue;
        }
        if (cmd === "m") {
          feedSlots.add(slots.length);
          cutSlots.add(slots.length);
        }
        if (seg < MIN_SEG) continue;
        slots.push(dx, dy);
        firstPairWritten = true;
      }
    }
  }

  for (const base of [...tieBases].sort((a, b) => b - a)) {
    const ins = [8, 0, -8, 0, 8, 0, -8, 0];
    slots.splice(base + 2, 0, ...ins);
    void tiePairs;
  }

  if (slots.length % 2) slots.push(0);
  const nPairs = slots.length / 2;
  const bounds = [...colorSlots].sort((a, b) => a - b);
  const records: StitchPoint[] = [];
  const stream = new Uint8Array(nPairs * 4);
  const colorBytes = colorSlots.map((s) => s * 2 - 4);

  let x = 0, y = 0;
  let bi = 0;
  for (let p = 0; p < nPairs; p++) {
    if (p === 0) { x = Math.trunc(slots[0]) - wh; y = Math.trunc(slots[1]) - hh; }
    else { x += Math.trunc(slots[2 * p]); y += Math.trunc(slots[2 * p + 1]); }
    const slot = 2 * p;
    let xf = 0, yf = 0;
    if (bi < bounds.length && slot === bounds[bi] - 2) { xf |= FLAG_CMD | FLAG_COLOR; bi++; }
    if (feedSlots.has(slot)) yf |= FLAG_FEED;
    if (cutSlots.has(slot)) yf |= FLAG_CUT;
    if (p === nPairs - 1) xf |= FLAG_CMD | FLAG_END;
    records.push({ x, y, xflags: xf, yflags: yf });
    const xi = x & 0x1fff, yi = y & 0x1fff;
    stream[p * 4] = ((xi & 0x1f) << 3 | xf) & 0xff;
    stream[p * 4 + 1] = (xi >> 5) & 0xff;
    stream[p * 4 + 2] = ((yi & 0x1f) << 3 | yf) & 0xff;
    stream[p * 4 + 3] = (yi >> 5) & 0xff;
  }
  return { stream, colorNum: colorBytes, widthHalf: wh, heightHalf: hh, records };
}

export function unpackRecord(rec: Uint8Array): [number, number, number, number] {
  let x = (rec[0] >> 3) | (rec[1] << 5);
  let y = (rec[2] >> 3) | (rec[3] << 5);
  if (x & 0x1000) x -= 0x2000;
  if (y & 0x1000) y -= 0x2000;
  return [x, y, rec[0] & 7, rec[2] & 7];
}

export function unpackRecords(data: Uint8Array): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i + 3 < data.length; i += 4) {
    out.push(unpackRecord(data.slice(i, i + 4)));
  }
  return out;
}

export function transferBegin(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + 4 + 2);
  out[0] = 3;
  const dv = new DataView(out.buffer);
  dv.setUint32(1, data.length, true);
  let sum = 0;
  for (const b of data) sum = (sum + b) & 0xffff;
  dv.setUint16(5, sum, true);
  return out;
}

export function transferChunk(offset: number, chunk: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + chunk.length + 1);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, offset, true);
  out.set(chunk, 4);
  let sum = 0;
  for (const b of chunk) sum = (sum + b) & 0xff;
  out[4 + chunk.length] = sum;
  return out;
}

export function* chunks(data: Uint8Array, maxlen: number): Generator<[number, Uint8Array]> {
  for (let off = 0; off < data.length; off += maxlen) {
    yield [off, data.slice(off, off + maxlen)];
  }
}

export interface PesxPath {
  points: [number, number][];
  threadcode?: string;
  chartcode?: number;
  color?: [number, number, number];
}

export function writePesx(paths: PesxPath[], widthMm: number, heightMm: number, nomirror = false, character = ""): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push(
    `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `x-bilemb-pesxversion="1.0" viewBox="0 0 ${widthMm.toFixed(1)} ${heightMm.toFixed(1)}" ` +
    `width="${widthMm.toFixed(1)}mm" height="${heightMm.toFixed(1)}mm" ` +
    `x-bilemb-nomirror="${nomirror ? 1 : 0}" x-bilemb-character="${character}">`,
  );
  for (const pd of paths) {
    if (!pd.points || pd.points.length === 0) continue;
    const pts = pd.points;
    let d = `m ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    let cx = pts[0][0], cy = pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      d += ` l ${(pts[i][0] - cx).toFixed(1)} ${(pts[i][1] - cy).toFixed(1)}`;
      cx = pts[i][0]; cy = pts[i][1];
    }
    const [r, g, b] = pd.color ?? [0, 0, 0];
    const tc = pd.threadcode ?? "001";
    const cc = pd.chartcode ?? 13;
    lines.push(`  <path d="m 0.0 0.0 ${d}" fill="rgb(${r},${g},${b})" x-bilemb-threadcode="${tc}" x-bilemb-chartcode="${cc}"/>`);
  }
  lines.push("</svg>");
  return lines.join("\n");
}

export interface PenPage { widthU: number; heightU: number; hoop: [number, number]; stitchCount: number; colorCodes: number[]; }
export interface PenContainer { version: string; header: Uint8Array; pages: PenPage[]; }

const HOOP_TABLE: [number, number, number, number][] = [
  [1001, 1001, 100, 100],
  [1301, 1801, 130, 180],
  [1601, 2601, 160, 260],
  [1801, 3001, 180, 300],
  [2401, 3601, 240, 360],
  [3001, 2001, 300, 200],
];

function hoopFor(w: number, h: number): [number, number] {
  for (const [wmax, hmax, hw, hh] of HOOP_TABLE) {
    if (w < wmax && h < hmax) return [hw, hh];
  }
  if (w < 3601 && h < 2001) return [360, 200];
  if (w < 3601 && h < 3601) return [240, 360];
  return [0, 0];
}

export function parsePenContainer(data: Uint8Array): PenContainer {
  if (String.fromCharCode(...data.slice(0, 4)) !== "#PEN") throw new Error("missing #PEN magic");
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const ver = dv.getUint32(4, true);
  const cont: PenContainer = {
    version: ver === 0x31313030 ? "0011" : `raw:${ver.toString(16).padStart(8, "0")}`,
    header: data.slice(8, 8 + 0x16),
    pages: [],
  };
  let off = 8 + 0x16;
  const nPages = data[off++];
  const gridR = data[off++];
  const gridC = data[off++];
  const gridTotal = gridC === 0x48 || gridC === 0x26 ? (nPages + 1) * gridR * gridC : 0;
  if (gridTotal === 0) throw new Error("LCD grid dims unrecognized");
  off += gridTotal;
  const w = dv.getUint16(off, true); off += 2;
  const h = dv.getUint16(off, true); off += 2;
  off += 2;
  const stitchCount = dv.getInt32(off, true); off += 4;
  const lcdOff = dv.getInt32(off, true); off += 4 + (lcdOff > 0 ? lcdOff : 0);
  const page: PenPage = {
    widthU: w, heightU: h, hoop: hoopFor(w, h),
    stitchCount, colorCodes: Array.from(data.slice(off, off + nPages)),
  };
  cont.pages = [page];
  return cont;
}
