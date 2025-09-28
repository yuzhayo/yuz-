import type { GenericSprite, GenericApplication } from "./LogicTypes";
import type { LayerConfig } from "./sceneTypes";
import { toRad } from "./LogicMath";
import { STAGE_WIDTH, STAGE_HEIGHT } from "@shared/stages/Stage2048";

// Basic placement & ordering helpers (engine-agnostic)

export function logicZIndexFor(cfg: LayerConfig): number {
  const m = cfg.id.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

export function logicApplyBasicTransform(app: GenericApplication, sp: GenericSprite, cfg: LayerConfig) {
  const w = STAGE_WIDTH;
  const h = STAGE_HEIGHT;
  const xPct = cfg.position.xPct ?? 0;
  const yPct = cfg.position.yPct ?? 0;
  sp.x = (xPct / 100) * w;
  sp.y = (yPct / 100) * h;
  const s = (cfg.scale?.pct ?? 100) / 100;
  if (typeof sp.scale === 'object' && 'set' in sp.scale && typeof sp.scale.set === 'function') {
    sp.scale.set(s, s);
  } else {
    sp.scale.x = s;
    sp.scale.y = s;
  }
  sp.rotation = toRad(cfg.angleDeg ?? 0);
  if (sp.zIndex !== undefined) {
    sp.zIndex = logicZIndexFor(cfg);
  }
}
