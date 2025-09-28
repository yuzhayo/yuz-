import React from "react";
import { MainScreenBtnPanel } from "./MainScreenBtn";
import { useMainScreenBtnGesture } from "./MainScreenBtnGesture";
import MainScreenRendererBadge from "./MainScreenRendererBadge";
import MainScreenUpdater from "./MainScreenUpdater";
import MainScreenApiTester from "./MainScreenApiTester";
import { LogicStage } from "@shared/stages/Stage2048";
import type { RendererMode } from "./logic/LayerCreator";
import logicConfigJson from "./LogicConfig";
import type { LogicConfig } from "./logic/LayerCreator";

export type MainScreenProps = {
  rendererMode?: RendererMode; // 'pixi' (DOM fallback removed)
};

/**
 * Layar utama launcher yang menampilkan navigasi dock.
 * Menggunakan Pixi rendering untuk efek visual kosmik.
 */
export default function MainScreen(_props: MainScreenProps) {
  const gesture = useMainScreenBtnGesture();
  const label = "Renderer: Pixi";
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Pixi renderer canvas behind UI */}
      <div className="absolute inset-0">
        <LogicStage 
          buildSceneFromLogic={async (app: any, config: any) => {
            const { buildSceneFromLogic } = await import('./logic/EnginePixi');
            return buildSceneFromLogic(app, config);
          }}
          logicConfig={logicConfigJson as LogicConfig}
        />
      </div>
      {/* Invisible gesture target */}
      <div {...gesture.bindTargetProps()} className="absolute inset-0 pointer-events-auto" />
      {/* Subtle navigation hint - only show when panel is closed */}
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
      {/* Renderer badge and updater (hold with launcher) */}
      <MainScreenRendererBadge visible={gesture.open} label={label} />
      <MainScreenApiTester visible={gesture.open} />
      <MainScreenUpdater visible={gesture.open} />
    </div>
  );
}
