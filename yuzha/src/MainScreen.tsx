import React from "react";
import {
  MainScreenBtnPanel,
  useMainScreenBtnGesture,
  MainScreenRendererBadge,
  MainScreenUpdater,
  MainScreenApiTester,
} from "./MainScreenUtils";

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
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Simple background */}
      <div className="absolute inset-0 bg-black/20">
        {/* Simplified cosmic background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute top-3/4 right-1/4 w-24 h-24 bg-purple-500/20 rounded-full blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-1/4 left-1/2 w-16 h-16 bg-pink-500/20 rounded-full blur-xl animate-pulse delay-500"></div>
        </div>
      </div>
      
      {/* Invisible gesture target */}
      <div {...gesture.bindTargetProps()} className="absolute inset-0 pointer-events-auto" />
      
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