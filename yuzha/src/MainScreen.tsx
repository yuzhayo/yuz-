import React from "react";
import {
  MainScreenBtnPanel,
  useMainScreenBtnGesture,
  MainScreenRendererBadge,
  MainScreenUpdater,
  MainScreenApiTester,
} from "./MainScreenUtils";
import Stage2048System from "./Stage2048System";

export type MainScreenProps = {
  // Simplified without renderer dependencies
};

/**
 * Layar utama yuzha - simplified module display.
 * Simple display without complex logic system.
 */
export default function MainScreen(_props: MainScreenProps) {
  const gesture = useMainScreenBtnGesture();
  const label = "Yuzha Module";
  
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Stage2048 System - Exact launcher implementation */}
      <Stage2048System />
      
      {/* Invisible gesture target */}
      <div {...gesture.bindTargetProps()} className="absolute inset-0 pointer-events-auto z-10" />
      
      {/* Navigation hint */}
      {!gesture.open && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-black/30 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-white/70 border border-white/10">
            Tap and hold to access modules
          </div>
        </div>
      )}

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