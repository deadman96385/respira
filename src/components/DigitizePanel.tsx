import { useRef, useState } from "react";
import { usePatternStore } from "../stores/usePatternStore";
import { useDigitizeStore } from "../stores/useDigitizeStore";
import { designToPattern } from "../lib/digitize/designToPattern";
import { autoPunchDesign } from "../lib/digitize/autoPunch";
import type { DigitizedDesign, ShapeLayer } from "../lib/digitize/types";

const STITCH_TYPES: ShapeLayer["stitchType"][] = ["running", "satin", "tatami"];

export function DigitizePanel() {
  const setPattern = usePatternStore((s) => s.setPattern);
  const stitchType = useDigitizeStore((s) => s.stitchType);
  const setStitchType = useDigitizeStore((s) => s.setStitchType);
  const points = useDigitizeStore((s) => s.points);
  const hex = useDigitizeStore((s) => s.hex);
  const setHex = useDigitizeStore((s) => s.setHex);
  const removeLast = useDigitizeStore((s) => s.removeLast);
  const clear = useDigitizeStore((s) => s.clear);

  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addPoint = () => {
    const nx = parseFloat(x);
    const ny = parseFloat(y);
    if (Number.isNaN(nx) || Number.isNaN(ny)) {
      setError("Enter numeric x,y");
      return;
    }
    useDigitizeStore.getState().addPoint([nx, ny]);
    setX("");
    setY("");
    setError(null);
  };

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

  const handleAutoPunch = async (file: File) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      URL.revokeObjectURL(url);
      const design = autoPunchDesign(imageData, {
        threshold: 128,
        simplifyEpsilon: 2,
        stitchType: "tatami",
        hoopMm: [100, 100],
      });
      const data = designToPattern(design);
      setPattern(data, "autopunched.pesx");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "auto-punch failed");
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 border rounded-md bg-card">
      <h2 className="font-semibold text-sm">Digitize</h2>
      <label className="text-xs">
        Stitch type
        <select
          className="ml-2 border rounded px-1"
          value={stitchType}
          onChange={(e) => setStitchType(e.target.value as ShapeLayer["stitchType"])}
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
        <button className="text-xs px-2 py-1 border rounded" onClick={addPoint}>
          Add
        </button>
      </div>
      <div className="text-xs text-muted-foreground">
        Points: {points.length}
        {points.length > 0 && (
          <button className="ml-2 underline" onClick={removeLast}>
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

      <div className="border-t pt-2 mt-2">
        <p className="text-xs font-semibold mb-1">Auto-punch</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="text-xs"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleAutoPunch(f);
          }}
        />
      </div>
    </div>
  );
}
