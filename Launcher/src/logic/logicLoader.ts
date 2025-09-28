import type { LogicConfig } from "./sceneTypes";
import type { GenericApplication } from "./LogicTypes";
import { createLayerCreatorManager } from "./LayerCreator";
import type { SpriteFactory, EffectHandler } from "./LayerCreator";
import { createPixiSpriteFactory, createPixiEffectHandler, isPixiApplication } from "./EnginePixi";

// Re-export types from LayerCreator for backward compatibility
export type { BuiltLayer, BuildResult } from "./LogicTypes";

// Simplified buildSceneFromLogic function that delegates to LayerCreator
export async function buildSceneFromLogic(
  app: GenericApplication,
  cfg: LogicConfig,
) {
  let spriteFactory: SpriteFactory | undefined;
  let effectHandler: EffectHandler | undefined;
  
  // Detect engine type and create appropriate factories
  if (isPixiApplication(app)) {
    try {
      spriteFactory = createPixiSpriteFactory();
      effectHandler = createPixiEffectHandler();
    } catch (e) {
      console.warn("[logicLoader] Failed to create Pixi factories:", e);
    }
  } else {
    console.warn("[logicLoader] Non-Pixi application detected, DOM support limited");
    // For DOM or other engines, we could create a DOM sprite factory here
    // But for now, we'll let LayerCreator handle the lack of sprite factory
  }
  
  const layerCreatorManager = createLayerCreatorManager(spriteFactory);
  return await layerCreatorManager.init(app, cfg, effectHandler);
}
