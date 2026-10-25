import { useState } from "react";
import { usePatternStore } from "../stores/usePatternStore";
import { designToPattern } from "../lib/digitize/designToPattern";
import type { DigitizedDesign, ShapeLayer, StitchType } from "../lib/digitize/types";

const STITCH_TYPES: StitchType[] = ["running", "satin", "tatami"];

export function DigitizePanel() {
  const setPattern = usePatternStore((s) => s.setPattern);
  const [stitchType, setStitchType] = useState<StitchType>("running");
  const [points, setPoints] = useState<[number, number][]>([]);
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [hex, setHex] = useState("#FF0000");
  const [error, setError] = useState<string | null>(null);

  const addPoint = () => {
    const nx = parseFloat(x);
    const ny = parseFloat(y);
    if (Number.isNaN(nx) || Number.isNaN(ny)) {
      setError("Enter numeric x,y");
      return;
    }
    setPoints((p) => [...p, [nx, ny]]);
    setX("");
    setY("");
    setError(null);
  };

  const removeLast = () => setPoints((p) => p.slice(0, -1));
  const clear = () => setPoints([]);

  const generate = () => {
    if (points.length < 2) {
      setError("Need at least 2 points");
      return;
    }
    const layer: ShapeLayer = {
      id: `layer-${Date.now()}`,
      points,
      stitchType,
      params:
        stitchType === "running"
          ? { stitchLen: 2.5 }
          : stitchType === "satin"
            ? { width: 2.0, stitchLen: 0.4 }
            : { angleDeg: 0, rowSpacing: 0.4, stitchLen: 3.0 },
      thread: { hex, colorCode: "001", chartCode: 13 },
      closed: false,
    };
    const design: DigitizedDesign = {
      layers: [layer],
      hoopMm: [100, 100],
    };
    const data = designToPattern(design);
    setPattern(data, "digitized.pesx");
    setError(null);
  };

  return (
    <div className="flex flex-col gap-3 p-3 border rounded-md bg-card">
      <h2 className="font-semibold text-sm">Digitize</h2>
      <label className="text-xs">
        Stitch type
        <select
          className="ml-2 border rounded px-1"
          value={stitchType}
          onChange={(e) => setStitchType(e.target.value as StitchType)}
        >
          {STITCH_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Thread color
        <input
          type="color"
          className="ml-2"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <input
          className="border rounded px-1 w-16 text-xs"
          placeholder="x"
          value={x}
          onChange={(e) => setX(e.target.value)}
        />
        <input
          className="border rounded px-1 w-16 text-xs"
          placeholder="y"
          value={y}
          onChange={(e) => setY(e.target.value)}
        />
        <button
          className="text-xs px-2 py-1 border rounded"
          onClick={addPoint}
        >
          Add
        </button>
      </div>
      <div className="text-xs text-muted-foreground">
        Points: {points.length}
        {points.length > 0 && (
          <button
            className="ml-2 underline"
            onClick={removeLast}
          >
            undo
          </button>
        )}
        {points.length > 0 && (
          <button className="ml-2 underline" onClick={clear}>
            clear
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        className="text-xs px-2 py-1 border rounded bg-primary text-primary-foreground"
        onClick={generate}
      >
        Generate pattern
      </button>
    </div>
  );
}
