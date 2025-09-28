/**
 * LayerOrbit.ts - Modular Orbital Motion System
 *
 * ⚠️  AI AGENT CRITICAL INSTRUCTIONS:
 *
 * This file is organized into ISOLATED BLOCKS. Each block is marked as:
 * 🔴 CRITICAL - DO NOT DELETE (breaks core functionality)
 * 🟡 OPTIONAL - Safe to delete (removes animations/effects but basic display works)
 * 🟢 UTILITY - Safe to delete (math helpers only, no visual impact)
 *
 * Deleting any 🔴 CRITICAL block will break the application!
 * 🟡 OPTIONAL blocks can be safely removed to reduce features.
 * 🟢 UTILITY blocks provide math helpers and can be deleted.
 */

import { STAGE_WIDTH, STAGE_HEIGHT } from "@shared/stages/Stage2048";

// Import all contracts from centralized location
import type { GenericApplication, GenericSprite, BuiltLayer, LayerConfig } from "./LayerContracts";

// ===================================================================
// 🟢 BLOCK 1: UTILITY MATH AND GEOMETRY FUNCTIONS
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete if not needed
// These are helper functions for math operations and geometry calculations
// ===================================================================

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function normDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

function clampRpm60(v: unknown): number {
  const n = typeof v === "number" ? v : v == null ? 0 : Number(v);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.min(60, Math.max(0, n));
}

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

// ===================================================================
// 🔴 BLOCK 2: ORBIT TYPES AND DEFAULTS
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// These types define the orbital motion system structure
// ===================================================================

// Engine-agnostic orbit item for basic orbital motion
export type OrbitItem = {
  sprite: GenericSprite;
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

// Orbit policy type definitions
type OrbitDirection = "cw" | "ccw";
type OrbitOrientPolicy = "none" | "auto" | "override";

// Default orbit configuration values
const DEFAULT_ORBIT_CENTER = { xPct: 50, yPct: 50 };
const _DEFAULT_ORBIT_DIRECTION: OrbitDirection = "cw";
const _DEFAULT_ORIENT_POLICY: OrbitOrientPolicy = "none";

// ===================================================================
// 🔴 BLOCK 3: CONFIG NORMALIZATION FUNCTIONS
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Handles orbit configuration validation and normalization
// ===================================================================

/**
 * Clamps orbit center percentage values to valid range
 */
function clampOrbitCenter(
  centerConfig: { xPct?: number; yPct?: number } | null | undefined,
  fallback: { xPct: number; yPct: number } = DEFAULT_ORBIT_CENTER,
): { x: number; y: number } {
  return {
    x: clamp(centerConfig?.xPct ?? fallback.xPct, 0, 100),
    y: clamp(centerConfig?.yPct ?? fallback.yPct, 0, 100),
  };
}

/**
 * Normalizes orbit direction from config to numeric value
 */
function normalizeOrbitDirection(direction: string | undefined): 1 | -1 {
  return direction === "ccw" ? -1 : 1;
}

/**
 * Normalizes and validates orbit orientation policy
 */
function normalizeOrientPolicy(policy: string | undefined): OrbitOrientPolicy {
  if (policy === "auto" || policy === "override") return policy;
  return "none";
}

/**
 * Calculates radians per second from RPM
 */
function rpmToRadPerSec(rpm: number): number {
  return (rpm * Math.PI) / 30;
}

/**
 * Converts orientation degrees to radians with validation
 */
function normalizeOrientDegrees(orientDeg: number | null | undefined): number {
  if (typeof orientDeg === "number" && isFinite(orientDeg)) {
    return toRad(orientDeg);
  }
  return 0;
}

// ===================================================================
// 🔴 BLOCK 4: MANAGER INTERFACE AND FACTORY
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Main interface that external code depends on
// ===================================================================

// Engine-agnostic orbit manager for orbital motion
export interface LayerOrbitManager {
  init(
    app: GenericApplication,
    built: BuiltLayer[],
    spinRpmBySprite?: Map<GenericSprite, number>,
  ): void;
  tick(elapsed: number): void;
  recompute(elapsed: number): void;
  dispose(): void;
  getItems(): OrbitItem[];
}

// Create orbit manager
export function createLayerOrbitManager(): LayerOrbitManager {
  const items: OrbitItem[] = [];
  let _app: GenericApplication | null = null;

  // ===================================================================
  // 🔴 BLOCK 5: CORE IMPLEMENTATION
  // ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
  // Main orbital motion processing logic
  // ===================================================================

  return {
    init(
      application: GenericApplication,
      built: BuiltLayer[],
      spinRpmBySprite?: Map<GenericSprite, number>,
    ) {
      _app = application;
      items.length = 0;

      for (const b of built) {
        // Only handle basic orbital motion (clock-driven orbit is handled by LayerClock)
        if (!b.cfg.clock?.enabled) {
          const rpm = clampRpm60(b.cfg.orbitRPM);
          if (rpm <= 0) continue;

          const orbitCenter = b.cfg.orbitCenter || DEFAULT_ORBIT_CENTER;
          const centerPct = clampOrbitCenter(orbitCenter);
          const dir = normalizeOrbitDirection(b.cfg.orbitDir);

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

          const radPerSec = rpmToRadPerSec(rpm);
          const orientPolicy = normalizeOrientPolicy(b.cfg.orbitOrientPolicy);
          const orientDegRad = normalizeOrientDegrees(b.cfg.orbitOrientDeg);
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
            orientPolicy,
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

    // ===================================================================
    // 🟡 BLOCK 6: DIAGNOSTICS AND UTILITIES
    // ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes diagnostics)
    // Provides debugging and inspection capabilities
    // ===================================================================

    getItems(): OrbitItem[] {
      return [...items];
    },
  };
}

// ===================================================================
// 🟢 BLOCK 7: CONVENIENCE EXPORTS
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete (convenience only)
// Export functions for external use
// ===================================================================

// Export convenience functions
export function createOrbitManager(): LayerOrbitManager {
  return createLayerOrbitManager();
}

// Export utility functions that other modules need
export { projectToRectBorder };

// Re-export geometry utilities for convenience
export { calculateOrbitCenter, calculateOrbitRadius, calculateOrbitPhase, clampOrbitCenter };
