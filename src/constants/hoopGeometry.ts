/**
 * Physical geometry of the Brother PP-1 embroidery hoop and its 4 fiducial
 * "vision" markers, used to register a photo of the hooped fabric into the
 * machine's coordinate system.
 *
 * All derived coordinates are expressed in the app's internal unit: **0.1mm,
 * hoop-center-relative** (millimetres × 10), with +X right and +Y down, exactly
 * matching the Konva canvas / embroidery coordinate space. Convert with mm × 10.
 */

/** Millimetres → internal 0.1mm units. */
export const MM = 10;

/** Inner opening of the hoop is a 129.5mm square, centered on the origin. */
export const HOOP_INNER_MM = 129.5;

/** Side length of each (identical) square fiducial marker. */
export const MARKER_SIZE_MM = 12;

/**
 * Distance from the inner edge the marker is offset *along* (parallel to), to
 * the marker's near edge. For the top marker this is measured horizontally from
 * the left inner edge to the marker's left edge.
 */
export const MARKER_INSET_MM = 24;

/**
 * Perpendicular gap from the inner edge the marker sits *beyond*, to the
 * marker's near edge. For the top marker this is the vertical gap from the top
 * inner edge up to the marker's bottom edge.
 */
export const MARKER_EDGE_GAP_MM = 6;

/** Half the inner opening, in 0.1mm units (± this is an inner edge). */
export const HOOP_INNER_HALF = (HOOP_INNER_MM * MM) / 2; // 647.5

/** Marker side length, in 0.1mm units. */
export const MARKER_SIZE = MARKER_SIZE_MM * MM; // 120

export type Point = { x: number; y: number };

/** Which side of the frame a marker sits on. Markers are in a 90° pinwheel. */
export type MarkerSide = "top" | "right" | "bottom" | "left";

export interface MarkerGeometry {
  side: MarkerSide;
  /** Center of the marker square, in 0.1mm hoop-center units. */
  center: Point;
  /** The 4 corners [TL, TR, BR, BL] of the axis-aligned marker square. */
  corners: [Point, Point, Point, Point];
}

/** Rotate a point 90° clockwise about the origin: (x, y) → (-y, x). */
function rotate90(p: Point): Point {
  return { x: -p.y, y: p.x };
}

/*
 * Marker centers come from the physical measurements: the top marker's left
 * edge is MARKER_INSET_MM right of the left inner edge, and its bottom edge is
 * MARKER_EDGE_GAP_MM above the top inner edge. The others follow by 90° turns.
 */

/** Corners of an axis-aligned square marker of size MARKER_SIZE about `center`. */
function markerCorners(center: Point): [Point, Point, Point, Point] {
  const h = MARKER_SIZE / 2;
  return [
    { x: center.x - h, y: center.y - h }, // TL
    { x: center.x + h, y: center.y - h }, // TR
    { x: center.x + h, y: center.y + h }, // BR
    { x: center.x - h, y: center.y + h }, // BL
  ];
}

const SIDES: MarkerSide[] = ["top", "right", "bottom", "left"];

// ---- Hoop sizes ----

/** The PP-1 hoops that hoop-photo alignment supports. */
export type HoopSize = "100" | "70";

/**
 * Inner opening (mm) of each hoop. The 70mm value assumes the small hoop uses
 * the same marker inset and gap as the standard hoop; turn on "Marker check"
 * after aligning to confirm the squares land on the real markers.
 */
export const HOOP_INNER_MM_BY_SIZE: Record<HoopSize, number> = {
  "100": HOOP_INNER_MM,
  "70": 70,
};

/** The four markers for a hoop with the given inner opening (mm). */
function markersForHoop(hoopInnerMm: number): MarkerGeometry[] {
  const half = (hoopInnerMm * MM) / 2;
  let center: Point = {
    x: -half + MARKER_INSET_MM * MM + MARKER_SIZE / 2,
    y: -half - MARKER_EDGE_GAP_MM * MM - MARKER_SIZE / 2,
  };
  const out: MarkerGeometry[] = [];
  for (const side of SIDES) {
    out.push({ side, center, corners: markerCorners(center) });
    center = rotate90(center);
  }
  return out;
}

/**
 * All four markers, in order [top, right, bottom, left], generated from the top
 * marker by successive 90° clockwise rotations about the hoop center.
 *
 * Centers (0.1mm units):
 *   top    (-347.5, -767.5)
 *   right  ( 767.5, -347.5)
 *   bottom ( 347.5,  767.5)
 *   left   (-767.5,  347.5)
 */
export const MARKERS: MarkerGeometry[] = markersForHoop(HOOP_INNER_MM);

/** Flat list of all 16 marker corners, grouped by marker (for a 16-point fit). */
export const MARKER_CORNERS: Point[] = MARKERS.flatMap((m) => m.corners);

/** Largest |x| or |y| among the marker corners (~827.5), i.e. how far the
 *  frame-mounted markers reach from the hoop center. */
const MARKER_MAX_EXTENT = Math.max(
  ...MARKER_CORNERS.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))),
);

/**
 * Half-extent (0.1mm units) of the canvas region the photo is warped into.
 * Cropped to just beyond the markers so the view reaches the outer edge of the
 * hoop frame (showing the whole hoop + markers) without the surrounding table.
 * The small margin keeps the outer markers fully visible for the marker check.
 */
export const HOOP_VIEW_HALF = MARKER_MAX_EXTENT + 40; // ≈ 867.5 (86.75mm half)

/**
 * Classify a point (relative to the centroid of the 4 marker points) to the
 * frame side it belongs to. Works despite the pinwheel offset because each
 * marker's perpendicular distance from center dominates its along-edge offset.
 */
export function classifyMarkerSide(dx: number, dy: number): MarkerSide {
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy < 0 ? "top" : "bottom";
  }
  return dx > 0 ? "right" : "left";
}

const MARKERS_70 = markersForHoop(HOOP_INNER_MM_BY_SIZE["70"]);

/** Marker geometry for the selected hoop. */
export function markersForSize(size: HoopSize): MarkerGeometry[] {
  return size === "70" ? MARKERS_70 : MARKERS;
}

/** Marker centers for the selected hoop, keyed by frame side. */
export function markerCentersForSize(
  size: HoopSize,
): Record<MarkerSide, Point> {
  return Object.fromEntries(
    markersForSize(size).map((m) => [m.side, m.center]),
  ) as Record<MarkerSide, Point>;
}
