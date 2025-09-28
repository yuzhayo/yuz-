// Hub scaffold (parent). Phase 1 placeholder to keep behavior unchanged.
// In later phases, this will orchestrate processors (Basic, Spin, Orbit, ...).

import type { Application } from "pixi.js";
import type { LogicConfig } from "./sceneTypes";
import type { BuildResult } from "./LogicTypes";

// For now, delegate to the current implementation to keep behavior identical.
import { buildSceneFromLogic as buildSceneCurrent } from "./logicLoader";

export async function buildSceneFromLogicHub(
  app: Application,
  cfg: LogicConfig,
): Promise<BuildResult> {
  // Phase 1: passthrough
  return buildSceneCurrent(app, cfg) as unknown as BuildResult;
}
