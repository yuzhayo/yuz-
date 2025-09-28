import type { Application, Sprite } from "pixi.js";
import type { BuiltLayer } from "./LogicTypes";
import type { LayerConfig } from "./sceneTypes";
import { clampRpm60, clamp, clamp01, toRad, normDeg } from "./LogicMath";
import { STAGE_WIDTH, STAGE_HEIGHT } from "@shared/stages/Stage2048";

// Internal orbit math functions (moved from OrbitMath.ts)
/**
 * Projects a point to the border of a rectangle, finding the intersection
 * with the rectangle boundary along the line from center to the point.
 */
function projectToRectBorder(
  cx: number,
  cy: number,
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number } {
  if (x >= 0 && x <= w && y >= 0 && y <= h) return { x, y };
  const dx = x - cx;
  const dy = y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const eps = 1e-6;
  const cand: { t: number; x: number; y: number }[] = [];
  if (Math.abs(dx) > eps) {
    const t1 = (0 - cx) / dx;
    const y1 = cy + t1 * dy;
    if (t1 > 0 && y1 >= -1 && y1 <= h + 1) cand.push({ t: t1, x: 0, y: y1 });
    const t2 = (w - cx) / dx;
    const y2 = cy + t2 * dy;
    if (t2 > 0 && y2 >= -1 && y2 <= h + 1) cand.push({ t: t2, x: w, y: y2 });
  }
  if (Math.abs(dy) > eps) {
    const t3 = (0 - cy) / dy;
    const x3 = cx + t3 * dx;
    if (t3 > 0 && x3 >= -1 && x3 <= w + 1) cand.push({ t: t3, x: x3, y: 0 });
    const t4 = (h - cy) / dy;
    const x4 = cx + t4 * dx;
    if (t4 > 0 && x4 >= -1 && x4 <= w + 1) cand.push({ t: t4, x: x4, y: h });
  }
  if (cand.length === 0) return { x: clamp(x, 0, w), y: clamp(y, 0, h) };
  cand.sort((a, b) => a.t - b.t);
  const first = cand[0];
  if (!first) {
    return { x: clamp(x, 0, w), y: clamp(y, 0, h) };
  }
  return { x: first.x, y: first.y };
}

/**
 * Calculates orbital center position in pixels from percentage values
 */
function calculateOrbitCenter(
  centerPct: { x: number; y: number },
  stageWidth: number,
  stageHeight: number,
): { cx: number; cy: number } {
  return {
    cx: stageWidth * clamp01(centerPct.x / 100),
    cy: stageHeight * clamp01(centerPct.y / 100),
  };
}

/**
 * Calculates orbital radius from center to a position on the stage border
 */
function calculateOrbitRadius(
  centerPx: { cx: number; cy: number },
  positionPct: { xPct: number; yPct: number },
  stageWidth: number,
  stageHeight: number,
): number {
  const bx = stageWidth * ((positionPct.xPct ?? 0) / 100);
  const by = stageHeight * ((positionPct.yPct ?? 0) / 100);
  const start = projectToRectBorder(centerPx.cx, centerPx.cy, bx, by, stageWidth, stageHeight);
  return Math.hypot(start.x - centerPx.cx, start.y - centerPx.cy);
}

/**
 * Calculates initial orbital phase from position or explicit phase angle
 */
function calculateOrbitPhase(
  centerPx: { cx: number; cy: number },
  positionPct: { xPct: number; yPct: number },
  phaseDeg: number | null | undefined,
  stageWidth: number,
  stageHeight: number,
): number {
  if (typeof phaseDeg === "number" && isFinite(phaseDeg)) {
    return toRad(normDeg(phaseDeg));
  }

  const bx = stageWidth * ((positionPct.xPct ?? 0) / 100);
  const by = stageHeight * ((positionPct.yPct ?? 0) / 100);
  const start = projectToRectBorder(centerPx.cx, centerPx.cy, bx, by, stageWidth, stageHeight);
  return Math.atan2(start.y - centerPx.cy, start.x - centerPx.cx);
}

/**
 * Clamps orbit center percentage values to valid range
 */
function clampOrbitCenter(
  centerConfig: { xPct?: number; yPct?: number } | null | undefined,
  fallback: { xPct: number; yPct: number } = { xPct: 50, yPct: 50 },
): { x: number; y: number } {
  return {
    x: clamp(centerConfig?.xPct ?? fallback.xPct, 0, 100),
    y: clamp(centerConfig?.yPct ?? fallback.yPct, 0, 100),
  };
}

// Orbit item for basic orbital motion
export type OrbitItem = {
  sprite: Sprite;
  cfg: LayerConfig;
  dir: 1 | -1;
  radPerSec: number;
  centerPct: { x: number; y: number };
  centerPx: { cx: number; cy: number };
  radius: number;
  basePhase: number;
  orientPolicy: "none" | "auto" | "override";
  orientDegRad: number;
  spinRpm: number;
};

// Orbit manager for orbital motion
export interface LayerOrbitManager {
  init(app: Application, built: BuiltLayer[], spinRpmBySprite?: Map<Sprite, number>): void;
  tick(elapsed: number): void;
  recompute(elapsed: number): void;
  dispose(): void;
  getItems(): OrbitItem[];
}

// Create orbit manager
export function createLayerOrbitManager(): LayerOrbitManager {
  const items: OrbitItem[] = [];
  let _app: Application | null = null;

  return {
    init(application: Application, built: BuiltLayer[], spinRpmBySprite?: Map<Sprite, number>) {
      _app = application;
      items.length = 0;

      for (const b of built) {
        // Only handle basic orbital motion (clock-driven orbit is handled by LayerClock)
        if (!b.cfg.clock?.enabled) {
          const rpm = clampRpm60(b.cfg.orbitRPM);
          if (rpm <= 0) continue;

          const orbitCenter = b.cfg.orbitCenter || { xPct: 50, yPct: 50 };
          const centerPct = clampOrbitCenter(orbitCenter);
          const dir = b.cfg.orbitDir === "ccw" ? -1 : (1 as 1 | -1);

          const w = STAGE_WIDTH;
          const h = STAGE_HEIGHT;
          const centerPx = calculateOrbitCenter(centerPct, w, h);
          const radius = calculateOrbitRadius(
            centerPx,
            { xPct: b.cfg.position?.xPct ?? 0, yPct: b.cfg.position?.yPct ?? 0 },
            w,
            h,
          );

          if (radius <= 0) continue;

          const basePhase = calculateOrbitPhase(
            centerPx,
            { xPct: b.cfg.position?.xPct ?? 0, yPct: b.cfg.position?.yPct ?? 0 },
            b.cfg.orbitPhaseDeg,
            w,
            h,
          );

          const radPerSec = (rpm * Math.PI) / 30;
          const policy = (b.cfg.orbitOrientPolicy ?? "none") as "none" | "auto" | "override";
          const orientDeg =
            typeof b.cfg.orbitOrientDeg === "number" && isFinite(b.cfg.orbitOrientDeg)
              ? b.cfg.orbitOrientDeg
              : 0;
          const orientDegRad = (orientDeg * Math.PI) / 180;
          const spinRpm = spinRpmBySprite?.get(b.sprite) ?? 0;

          items.push({
            sprite: b.sprite,
            cfg: b.cfg,
            dir,
            radPerSec,
            centerPct,
            centerPx,
            radius,
            basePhase,
            orientPolicy: policy,
            orientDegRad,
            spinRpm,
          });
        }
      }
    },

    tick(elapsed: number) {
      for (const item of items) {
        if (item.radius <= 0) continue;

        const angle = item.basePhase + item.dir * item.radPerSec * elapsed;
        item.sprite.x = item.centerPx.cx + item.radius * Math.cos(angle);
        item.sprite.y = item.centerPx.cy + item.radius * Math.sin(angle);

        // Handle orientation policy
        if (
          item.orientPolicy === "override" ||
          (item.orientPolicy === "auto" && item.spinRpm <= 0)
        ) {
          item.sprite.rotation = angle + item.orientDegRad;
        }
      }
    },

    recompute(elapsed: number) {
      const w = STAGE_WIDTH;
      const h = STAGE_HEIGHT;

      for (const item of items) {
        // Store current angle to maintain continuity
        const oldAngle = Math.atan2(
          item.sprite.y - item.centerPx.cy,
          item.sprite.x - item.centerPx.cx,
        );

        // Recalculate center and radius based on current stage dimensions
        const centerPx = calculateOrbitCenter(item.centerPct, w, h);
        const radius = calculateOrbitRadius(
          centerPx,
          { xPct: item.cfg.position?.xPct ?? 0, yPct: item.cfg.position?.yPct ?? 0 },
          w,
          h,
        );

        item.centerPx = centerPx;
        item.radius = radius;

        if (radius > 0) {
          // Adjust base phase to maintain current position
          const currentBase = oldAngle;
          item.basePhase = currentBase - item.dir * item.radPerSec * elapsed;

          // Update sprite position immediately
          item.sprite.x = centerPx.cx + radius * Math.cos(currentBase);
          item.sprite.y = centerPx.cy + radius * Math.sin(currentBase);
        }
      }
    },

    dispose() {
      items.length = 0;
      _app = null;
    },

    getItems(): OrbitItem[] {
      return [...items];
    },
  };
}

// Export convenience functions
export function createOrbitManager(): LayerOrbitManager {
  return createLayerOrbitManager();
}

// Export utility functions that other modules need
export {
  projectToRectBorder,
};

// Re-export math utilities for convenience (now internal functions)
export {
  calculateOrbitCenter,
  calculateOrbitRadius,
  calculateOrbitPhase,
  clampOrbitCenter,
};
