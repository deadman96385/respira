import { useShallow } from "zustand/react/shallow";
import { useMachineStore, usePatternUploaded } from "../stores/useMachineStore";
import { usePatternStore } from "../stores/usePatternStore";
import { useState } from "react";
import { ConnectionPrompt } from "./ConnectionPrompt";
import { FileUpload } from "./FileUpload";
import { DigitizePanel } from "./DigitizePanel";
import { PatternSummaryCard } from "./PatternSummaryCard";
import { ProgressMonitor } from "./ProgressMonitor";

export function LeftSidebar() {
  const { isConnected } = useMachineStore(
    useShallow((state) => ({
      isConnected: state.isConnected,
    })),
  );

  const { pesData, uploadedPesData } = usePatternStore(
    useShallow((state) => ({
      pesData: state.pesData,
      uploadedPesData: state.uploadedPesData,
    })),
  );

  const [digitizeMode, setDigitizeMode] = useState(false);

  // Derived state: pattern is uploaded if machine has pattern info
  const patternUploaded = usePatternUploaded();
  const hasPattern = pesData || uploadedPesData;

  return (
    <div className="flex flex-col gap-4 md:gap-5 lg:gap-6 lg:overflow-hidden">
      {/* Connect Button or Browser Hint - Show when disconnected */}
      {!isConnected && <ConnectionPrompt />}

      {/* Mode toggle - Show during upload stage */}
      {isConnected && !patternUploaded && (
        <div className="flex gap-2">
          <button
            className={`text-xs px-2 py-1 border rounded ${!digitizeMode ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setDigitizeMode(false)}
          >
            Import PES
          </button>
          <button
            className={`text-xs px-2 py-1 border rounded ${digitizeMode ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setDigitizeMode(true)}
          >
            Digitize
          </button>
        </div>
      )}

      {/* Pattern File - Show during upload stage (before pattern is uploaded) */}
      {isConnected && !patternUploaded && !digitizeMode && <FileUpload />}

      {/* Digitize Panel */}
      {isConnected && !patternUploaded && digitizeMode && <DigitizePanel />}

      {/* Compact Pattern Summary - Show after upload (during sewing stages) */}
      {isConnected && patternUploaded && hasPattern && <PatternSummaryCard />}

      {/* Progress Monitor - Show when pattern is uploaded */}
      {isConnected && patternUploaded && (
        <div className="lg:flex-1 lg:min-h-0">
          <ProgressMonitor />
        </div>
      )}
    </div>
  );
}
