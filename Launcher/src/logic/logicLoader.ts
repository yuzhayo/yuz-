import type { Application } from "pixi.js";
import type { LogicConfig } from "./sceneTypes";
import { createLayerCreatorManager } from "./LayerCreator";

// Re-export types from LayerCreator for backward compatibility
export type { BuiltLayer, BuildResult } from "./LogicTypes";

// Simplified buildSceneFromLogic function that delegates to LayerCreator
export async function buildSceneFromLogic(
  app: Application,
  cfg: LogicConfig,
) {
  const layerCreatorManager = createLayerCreatorManager();
  return await layerCreatorManager.init(app, cfg);
}
