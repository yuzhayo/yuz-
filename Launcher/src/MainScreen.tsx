import React from "react";
import {
  MainScreenBtnPanel,
  useMainScreenBtnGesture,
  MainScreenRendererBadge,
  MainScreenUpdater,
  MainScreenApiTester,
} from "./MainScreenUtils";
import Stage2048System from "./Stage2048System";

/**
 * Simplified without renderer dependencies.
 */
export type MainScreenProps = Record<string, never>;

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
