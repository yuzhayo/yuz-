import React from "react";
import type { Stage2048Instance } from "./LayerEngine";
import type { StageTransform } from "./LayerCore";
import { createStage2048, buildSceneFromLogic } from "./LayerEngine";
import { getLogicConfig } from "./LayerConfig";

export interface Stage2048SystemProps {
  onStageReady?: (canvas: HTMLCanvasElement, transform: StageTransform) => void;
}

export default function Stage2048System({ onStageReady }: Stage2048SystemProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const stageRef = React.useRef<Stage2048Instance | null>(null);
  const cleanupSceneRef = React.useRef<(() => void) | undefined>();

  React.useEffect(() => {
    const rootElement = rootRef.current;
    if (!rootElement) return;

    let disposed = false;

    const emitStageReady = () => {
      if (!onStageReady) return;
      const stage = stageRef.current;
      if (!stage) return;
      const canvas = stage.app?.view as HTMLCanvasElement | undefined;
      const transform = stage.getTransform();
      if (canvas && transform) {
        onStageReady(canvas, transform);
      }
    };

    (async () => {
      try {
        const stage = await createStage2048(rootElement, {
          backgroundAlpha: 0,
          antialias: true,
          autoInjectCSS: true,
          debug: false,
        });
        if (disposed) {
          stage.dispose();
          return;
        }

        stageRef.current = stage;

        const logicConfig = getLogicConfig();
        const scene = await buildSceneFromLogic(stage.app, logicConfig);
        if (disposed) {
          if (scene?.container) {
            try {
              (scene.container as any)._cleanup?.();
            } catch {}
            try {
              (scene.container as any).destroy?.({ children: true });
            } catch {}
          }
          stage.dispose();
          return;
        }

        stage.app.stage.addChild(scene.container);

        cleanupSceneRef.current = () => {
          const container = scene.container as any;
          try {
            container._cleanup?.();
          } catch {}
          try {
            stage.app.stage.removeChild(scene.container);
          } catch {}
          try {
            container.destroy?.({ children: true });
          } catch {}
        };

        emitStageReady();
        window.addEventListener("resize", emitStageReady);
      } catch (error) {
        console.error("[Stage2048System] Failed to initialize cosmic stage", error);
      }
    })();

    return () => {
      disposed = true;
      window.removeEventListener("resize", emitStageReady);
      cleanupSceneRef.current?.();
      cleanupSceneRef.current = undefined;

      if (stageRef.current) {
        stageRef.current.dispose();
        stageRef.current = null;
      }
    };
  }, [onStageReady]);

  return <div ref={rootRef} className="stage-cover-root" />;
}

// Export React-specific helpers
export { Stage2048System };

// Export additional types and utilities from the new pipeline
export type { StageTransform, StageCoordinates } from "./LayerCore";
export type { Stage2048Options, Stage2048Instance } from "./LayerEngine";
export type { LogicConfig } from "./LayerConfig";
export { getLogicConfig } from "./LayerConfig";