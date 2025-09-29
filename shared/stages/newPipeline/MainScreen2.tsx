import React from "react";
import {
  MainScreenBtnPanel,
  useMainScreenBtnGesture,
  MainScreenRendererBadge,
  MainScreenUpdater,
  MainScreenApiTester,
} from "../../../Launcher/src/MainScreenUtils";
import { Stage2048System } from "./LayerStages";

/**
 * Simplified without renderer dependencies.
 */
export type MainScreen2Props = Record<string, never>;

/**
 * MainScreen2 - New pipeline implementation
 * Layar utama yuzha - simplified module display using new pipeline.
 * Simple display without complex logic system.
 */
export default function MainScreen2(_props: MainScreen2Props) {
  const gesture = useMainScreenBtnGesture();
  const label = "Yuzha Module (New Pipeline)";
  
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* New Pipeline Banner - Distinguishing marker */}
      <div className="pointer-events-none select-none fixed top-3 left-3 z-[9999] text-[10px] px-2 py-0.5 rounded bg-green-600/80 border border-green-400/30 text-white/90 shadow-sm">
        🚀 New Pipeline
      </div>
      
      {/* Stage2048 System - Using new pipeline implementation */}
      <Stage2048System />
      
      {/* Invisible gesture target */}
      <div {...gesture.bindTargetProps()} className="absolute inset-0 pointer-events-auto z-10" />
      
      {/* Navigation dock */}
      <MainScreenBtnPanel
        open={gesture.open}
        onToggle={gesture.toggle}
        effect={{ kind: "fade" }}
        title="Modules"
        target="_self"
      />
      
      {/* Status displays */}
      <MainScreenRendererBadge visible={gesture.open} label={label} />
      <MainScreenApiTester visible={gesture.open} />
      <MainScreenUpdater visible={gesture.open} />
    </div>
  );
}

// Export related utilities and types from the new pipeline
export type { 
  StageTransform, 
  StageCoordinates,
  Stage2048Options,
  Stage2048Instance,
  LogicConfig 
} from "./LayerStages";

// Re-export utility functions for external use
export { getLogicConfig } from "./LayerStages";