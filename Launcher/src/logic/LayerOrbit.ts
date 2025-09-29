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

// Import all contracts and utilities from centralized location
import { STAGE_WIDTH, STAGE_HEIGHT, clamp, clamp01, toRad, normDeg, clampRpm60, warn, debug, error } from "./LayerCreator";
import type { 
  GenericApplication, 
  GenericSprite, 
  BuiltLayer, 
  LayerConfig,
  StandardLayerManager,
  LayerModuleInitConfig,
  LayerModuleResult,
  LayerModulePerformance
} from "./LayerCreator";

// ===================================================================
// 🟢 BLOCK 1: ORBIT-SPECIFIC GEOMETRY FUNCTIONS
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete if not needed
// These are orbit-specific helper functions (general utilities imported from LayerCreator)
// ===================================================================

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
export interface LayerOrbitManager extends StandardLayerManager {
  // Standardized lifecycle methods with consistent signatures
  init(config: LayerModuleInitConfig): LayerModuleResult;
  tick(elapsed: number): LayerModuleResult;
  recompute(): LayerModuleResult;
  dispose(): LayerModuleResult;
  
  // Manager-specific methods
  getItems(): OrbitItem[];
  
  // Required metadata properties
  readonly name: string;
  readonly version: string;
  readonly isRequired: boolean;
  readonly hasActiveItems: boolean;
  readonly itemCount: number;
  readonly isInitialized: boolean;
  
  // Performance and validation
  getPerformanceStats(): Record<string, number>;
  validateConfiguration(): LayerModuleResult<boolean>;
}

// Create orbit manager
export function createLayerOrbitManager(): LayerOrbitManager {
  const items: OrbitItem[] = [];
  let _app: GenericApplication | null = null;
  let _isInitialized = false;
  let _performance: LayerModulePerformance = {};
  let _spinRpmBySprite: Map<GenericSprite, number> = new Map();
  const _performanceStats = {
    initTime: 0,
    tickTime: 0,
    recomputeTime: 0,
    itemCount: 0,
    lastTickDuration: 0
  };

  // ===================================================================
  // 🔴 BLOCK 5: CORE IMPLEMENTATION
  // ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
  // Main orbital motion processing logic
  // ===================================================================

  const manager: LayerOrbitManager = {
    // Required metadata properties
    name: "LayerOrbitManager",
    version: "2.0.0",
    isRequired: false,
    
    get hasActiveItems(): boolean {
      return items.length > 0;
    },
    
    get itemCount(): number {
      return items.length;
    },
    
    get isInitialized(): boolean {
      return _isInitialized;
    },
    init(config: LayerModuleInitConfig): LayerModuleResult {
      const startTime = performance.now();
      const warnings: string[] = [];
      
      try {
        // Validate input configuration
        if (!config.app) {
          return { success: false, error: "Missing application instance" };
        }
        if (!config.layers || !Array.isArray(config.layers)) {
          return { success: false, error: "Missing or invalid layers array" };
        }

        _app = config.app;
        _performance = config.performance || {};
        items.length = 0;
        _isInitialized = false;
        _spinRpmBySprite = (config.dependencies?.spinRpmBySprite instanceof Map) 
          ? config.dependencies.spinRpmBySprite 
          : new Map();

        // Process each layer with error handling
        for (const b of config.layers) {
          try {
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
              const spinRpm = _spinRpmBySprite.get(b.sprite) ?? 0;

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
          } catch (e) {
            const errorMsg = `Failed to create orbit item for layer ${b.id}: ${e}`;
            warn("LayerOrbit", errorMsg);
            warnings.push(errorMsg);
          }
        }

        _isInitialized = true;
        _performanceStats.initTime = performance.now() - startTime;
        _performanceStats.itemCount = items.length;

        debug("LayerOrbit", `Initialized with ${items.length} orbit items`);
        
        return { 
          success: true, 
          warnings: warnings.length > 0 ? warnings : undefined,
          data: undefined
        };
      } catch (e) {
        error("LayerOrbit", `Initialization failed: ${e}`);
        return { success: false, error: `Initialization failed: ${e}` };
      }
    },

    tick(elapsed: number): LayerModuleResult {
      if (!_isInitialized) {
        return { success: false, error: "Manager not initialized" };
      }

      // Early return optimization
      if (_performance.enableEarlyReturns && items.length === 0) {
        return { success: true };
      }

      const startTime = performance.now();
      
      try {
        // Performance limit check
        const maxTime = _performance.maxProcessingTimeMs || 16; // Default 16ms (60fps)
        
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
        
        const duration = performance.now() - startTime;
        _performanceStats.lastTickDuration = duration;
        
        if (duration > maxTime && _performance.debugMode) {
          warn("LayerOrbit", `Tick duration ${duration}ms exceeded limit ${maxTime}ms`);
        }

        return { success: true };
      } catch (e) {
        error("LayerOrbit", `Tick failed: ${e}`);
        return { success: false, error: `Tick failed: ${e}` };
      }
    },

    recompute(): LayerModuleResult {
      if (!_isInitialized) {
        return { success: false, error: "Manager not initialized" };
      }

      const startTime = performance.now();
      
      try {
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
            // For recompute, we maintain current visual position by not adjusting basePhase
            // Update sprite position immediately based on new dimensions
            item.sprite.x = centerPx.cx + radius * Math.cos(oldAngle);
            item.sprite.y = centerPx.cy + radius * Math.sin(oldAngle);
          }
        }
        
        _performanceStats.recomputeTime = performance.now() - startTime;
        debug("LayerOrbit", `Recomputed ${items.length} orbit items`);
        
        return { success: true };
      } catch (e) {
        error("LayerOrbit", `Recompute failed: ${e}`);
        return { success: false, error: `Recompute failed: ${e}` };
      }
    },

    dispose(): LayerModuleResult {
      try {
        items.length = 0;
        _app = null;
        _isInitialized = false;
        _spinRpmBySprite.clear();
        
        // Clear performance stats
        _performanceStats.initTime = 0;
        _performanceStats.tickTime = 0;
        _performanceStats.recomputeTime = 0;
        _performanceStats.itemCount = 0;
        _performanceStats.lastTickDuration = 0;
        
        debug("LayerOrbit", "Manager disposed successfully");
        return { success: true };
      } catch (e) {
        error("LayerOrbit", `Dispose failed: ${e}`);
        return { success: false, error: `Dispose failed: ${e}` };
      }
    },

    getItems(): OrbitItem[] {
      return [...items];
    },

    getPerformanceStats(): Record<string, number> {
      return { ..._performanceStats };
    },

    validateConfiguration(): LayerModuleResult<boolean> {
      try {
        const isValid = _isInitialized && _app !== null;
        return { 
          success: true, 
          data: isValid 
        };
      } catch (e) {
        return { 
          success: false, 
          error: `Validation failed: ${e}` 
        };
      }
    }
  };

  return manager;
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
