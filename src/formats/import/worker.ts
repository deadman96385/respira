import { loadPyodide, type PyodideInterface } from "pyodide";
import { normalizePesCommands, type PesCommands } from "./normalizeCommands";
import { encodeStitchesToPen } from "../pen/encoder";

// Message types from main thread
export type WorkerMessage =
  | { type: "INITIALIZE"; pyodideIndexURL?: string; pystitchWheelURL?: string }
  | { type: "CONVERT_PES"; fileData: ArrayBuffer; fileName: string };

// Response types to main thread
export type WorkerResponse =
  | { type: "INIT_PROGRESS"; progress: number; step: string }
  | { type: "INIT_COMPLETE" }
  | { type: "INIT_ERROR"; error: string }
  | {
      type: "CONVERT_COMPLETE";
      data: {
        stitches: number[][];
        threads: Array<{
          color: number;
          hex: string;
          brand: string | null;
          catalogNumber: string | null;
          description: string | null;
          chart: string | null;
        }>;
        uniqueColors: Array<{
          color: number;
          hex: string;
          brand: string | null;
          catalogNumber: string | null;
          description: string | null;
          chart: string | null;
          threadIndices: number[];
        }>;
        penData: number[]; // Serialized as array
        colorCount: number;
        stitchCount: number;
        bounds: {
          minX: number;
          maxX: number;
          minY: number;
          maxY: number;
        };
      };
    }
  | { type: "CONVERT_ERROR"; error: string };

console.log("[PatternConverterWorker] Worker script loaded");

let pyodide: PyodideInterface | null = null;
let isInitializing = false;

/**
 * Initialize Pyodide with progress tracking
 */
async function initializePyodide(
  pyodideIndexURL?: string,
  pystitchWheelURL?: string,
) {
  if (pyodide) {
    return; // Already initialized
  }

  if (isInitializing) {
    throw new Error("Initialization already in progress");
  }

  isInitializing = true;

  try {
    self.postMessage({
      type: "INIT_PROGRESS",
      progress: 0,
      step: "Starting initialization...",
    } as WorkerResponse);

    console.log("[PyodideWorker] Loading Pyodide runtime...");

    self.postMessage({
      type: "INIT_PROGRESS",
      progress: 10,
      step: "Loading Python runtime...",
    } as WorkerResponse);

    // Load Pyodide runtime
    // Use provided URL or default to /assets/
    const indexURL = pyodideIndexURL || "/assets/";
    console.log("[PyodideWorker] Pyodide index URL:", indexURL);

    pyodide = await loadPyodide({
      indexURL: indexURL,
    });

    console.log("[PyodideWorker] Pyodide runtime loaded");

    self.postMessage({
      type: "INIT_PROGRESS",
      progress: 70,
      step: "Python runtime loaded",
    } as WorkerResponse);

    self.postMessage({
      type: "INIT_PROGRESS",
      progress: 75,
      step: "Loading pystitch library...",
    } as WorkerResponse);

    // Load pystitch wheel
    // Use provided URL or default
    const wheelURL = pystitchWheelURL || "/pystitch-1.0.0-py3-none-any.whl";
    console.log("[PyodideWorker] Pystitch wheel URL:", wheelURL);

    await pyodide.loadPackage(wheelURL);

    console.log("[PyodideWorker] pystitch library loaded");

    self.postMessage({
      type: "INIT_PROGRESS",
      progress: 100,
      step: "Ready!",
    } as WorkerResponse);

    self.postMessage({
      type: "INIT_COMPLETE",
    } as WorkerResponse);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[PyodideWorker] Initialization error:", err);

    self.postMessage({
      type: "INIT_ERROR",
      error: errorMsg,
    } as WorkerResponse);

    throw err;
  } finally {
    isInitializing = false;
  }
}

/**
 * Convert PES file to PEN format
 */
async function convertPesToPen(fileData: ArrayBuffer) {
  if (!pyodide) {
    throw new Error("Pyodide not initialized");
  }

  try {
    // Convert to Uint8Array
    const uint8Array = new Uint8Array(fileData);

    // Write file to Pyodide virtual filesystem
    const tempFileName = "/tmp/pattern.pes";
    pyodide.FS.writeFile(tempFileName, uint8Array);

    // Read the pattern using PyStitch (same logic as original converter)
    const result = await pyodide.runPythonAsync(`
import pystitch
from pystitch.EmbConstant import STITCH, JUMP, TRIM, STOP, END, COLOR_CHANGE, COMMAND_MASK

# Read the PES file
pattern = pystitch.read('${tempFileName}')

# Convert to JSON-serializable format
{
    'stitches': pattern.stitches,
    'commandConstants': dict(STITCH=STITCH, JUMP=JUMP, TRIM=TRIM, STOP=STOP, END=END, COLOR_CHANGE=COLOR_CHANGE, COMMAND_MASK=COMMAND_MASK),
    'threads': [
        {
            'color': thread.color if hasattr(thread, 'color') else 0,
            'hex': thread.hex_color() if hasattr(thread, 'hex_color') else '#000000',
            'catalog_number': thread.catalog_number if hasattr(thread, 'catalog_number') else -1,
            'brand': thread.brand if hasattr(thread, 'brand') else "",
            'description': thread.description if hasattr(thread, 'description') else "",
            'chart': thread.chart if hasattr(thread, 'chart') else ""
        }
        for thread in pattern.threadlist
    ],
    'thread_count': len(pattern.threadlist),
    'stitch_count': sum(1 for x, y, cmd in pattern.stitches if (cmd & COMMAND_MASK) == STITCH)
}
    `);

    // Convert Python result to JavaScript
    const data = result.toJs({ dict_converter: Object.fromEntries });
    result.destroy();

    // Clean up virtual file
    try {
      pyodide.FS.unlink(tempFileName);
    } catch {
      // Ignore errors
    }

    // Extract stitches and validate
    const rawStitches: number[][] = Array.from(
      data.stitches as ArrayLike<ArrayLike<number>>,
    ).map((stitch) => Array.from(stitch));

    const normalized = normalizePesCommands(
      rawStitches,
      data.threads as Array<{
        color?: number;
        hex?: string;
        catalog_number?: number | string;
        brand?: string;
        description?: string;
        chart?: string;
      }>,
      data.commandConstants as PesCommands,
    );
    const stitches = normalized.stitches;
    if (!normalized.stitchCount) {
      throw new Error("Invalid PES file or no stitches found");
    }

    // Extract thread data - preserve null values for unavailable metadata
    const threads = (
      normalized.threads as Array<{
        color?: number;
        hex?: string;
        catalog_number?: number | string;
        brand?: string;
        description?: string;
        chart?: string;
      }>
    ).map((thread) => {
      // Normalize catalog_number - can be string or number from PyStitch
      const catalogNum = thread.catalog_number;
      const normalizedCatalog =
        catalogNum !== undefined &&
        catalogNum !== null &&
        catalogNum !== -1 &&
        catalogNum !== "-1" &&
        catalogNum !== ""
          ? String(catalogNum)
          : null;

      return {
        color: thread.color ?? 0,
        hex: thread.hex || "#000000",
        catalogNumber: normalizedCatalog,
        brand: thread.brand && thread.brand !== "" ? thread.brand : null,
        description:
          thread.description && thread.description !== ""
            ? thread.description
            : null,
        chart: thread.chart && thread.chart !== "" ? thread.chart : null,
      };
    });

    // Encode stitches to PEN format using the extracted encoder
    console.log("[patternConverter] Encoding stitches to PEN format...");
    console.log("  - Input stitches:", stitches);
    const { penBytes: penStitches, bounds } = encodeStitchesToPen(stitches);
    const { minX, maxX, minY, maxY } = bounds;

    // Calculate unique colors from threads (threads represent color blocks, not unique colors)
    const uniqueColors = threads.reduce(
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
      [] as Array<{
        color: number;
        hex: string;
        brand: string | null;
        catalogNumber: string | null;
        description: string | null;
        chart: string | null;
        threadIndices: number[];
      }>,
    );

    // Calculate PEN stitch count (should match what machine will count)
    const penStitchCount = penStitches.length / 4;

    console.log("[patternConverter] PEN encoding complete:");
    console.log(`  - PyStitch stitches: ${stitches.length}`);
    console.log(`  - PEN bytes: ${penStitches.length}`);
    console.log(`  - PEN stitches (bytes/4): ${penStitchCount}`);
    console.log(`  - Bounds: (${minX}, ${minY}) to (${maxX}, ${maxY})`);

    // Post result back to main thread
    self.postMessage({
      type: "CONVERT_COMPLETE",
      data: {
        stitches,
        threads,
        uniqueColors,
        penData: penStitches, // Send as array (will be converted to Uint8Array in main thread)
        colorCount: threads.length,
        stitchCount: normalized.stitchCount,
        bounds: {
          minX: minX === Infinity ? 0 : minX,
          maxX: maxX === -Infinity ? 0 : maxX,
          minY: minY === Infinity ? 0 : minY,
          maxY: maxY === -Infinity ? 0 : maxY,
        },
      },
    } as WorkerResponse);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[PyodideWorker] Conversion error:", err);

    self.postMessage({
      type: "CONVERT_ERROR",
      error: errorMsg,
    } as WorkerResponse);

    throw err;
  }
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  console.log("[PatternConverterWorker] Received message:", message.type);

  try {
    switch (message.type) {
      case "INITIALIZE":
        console.log("[PatternConverterWorker] Starting initialization...");
        await initializePyodide(
          message.pyodideIndexURL,
          message.pystitchWheelURL,
        );
        break;

      case "CONVERT_PES":
        console.log("[PatternConverterWorker] Starting PES conversion...");
        await convertPesToPen(message.fileData);
        break;

      default:
        console.error(
          "[PatternConverterWorker] Unknown message type:",
          message,
        );
    }
  } catch (err) {
    console.error("[PatternConverterWorker] Error handling message:", err);
  }
};

console.log("[PatternConverterWorker] Message handler registered");
