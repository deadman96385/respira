export type StitchType = "running" | "satin" | "tatami";

export interface ShapeLayer {
  id: string;
  points: [number, number][]; // mm, relative to hoop center
  stitchType: StitchType;
  params: {
    stitchLen?: number;
    width?: number;
    angleDeg?: number;
    rowSpacing?: number;
  };
  thread: {
    hex: string;
    colorCode: string;
    chartCode: number;
  };
  closed: boolean;
}

export interface DigitizedDesign {
  layers: ShapeLayer[];
  hoopMm: [number, number];
}
