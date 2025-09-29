/**
 * LayerSpin.ts - Modular Layer Spinning System
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

// Import core contracts and utilities from centralized location
import { clampRpm60, toRad, toDeg, warn, debug, error } from "./LayerCreator";
import type { 
  GenericSprite, 
  GenericApplication, 
  BuiltLayer,
  StandardLayerManager,
  LayerModuleInitConfig,
  LayerModuleResult,
  LayerModulePerformance
} from "./LayerCreator";

// ===================================================================
// 🟢 BLOCK 1: SPIN-SPECIFIC FUNCTIONS ONLY
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete if not needed
// General utility functions are now imported from LayerCreator
// ===================================================================

// ===================================================================
// 🔴 BLOCK 2: CORE SPIN TYPES
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Essential type definitions for spin system functionality
// ===================================================================

// Basic RPM-based spin item
export type BasicSpinItem = {
  sprite: GenericSprite;
  baseRad: number;
  radPerSec: number;
  dir: 1 | -1;
  mode: "basic";
};

export type SpinItem = BasicSpinItem;

// Basic spin manager for RPM-based spinning only
export interface LayerSpinManager extends StandardLayerManager {
  // Standardized lifecycle methods with consistent signatures
  init(config: LayerModuleInitConfig): LayerModuleResult;
  tick(elapsed: number): LayerModuleResult;
  recompute(): LayerModuleResult;
  dispose(): LayerModuleResult;
  
  // Manager-specific methods
  getSpinRpm(sprite: GenericSprite): number;
  getItems(): SpinItem[];
  
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

// ===================================================================
// 🔴 BLOCK 3: CONFIG NORMALIZATION
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Handles direction parsing and RPM validation
// ===================================================================

function normalizeSpinDirection(dir: string | undefined): 1 | -1 {
  return dir === "ccw" ? -1 : (1 as 1 | -1);
}

function calculateRadPerSec(rpm: number): number {
  return (rpm * Math.PI) / 30;
}

// ===================================================================
// 🔴 BLOCK 4: MANAGER INTERFACE AND FACTORY
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Main factory function that external code depends on
// ===================================================================

// Create basic spin manager
export function createLayerSpinManager(): LayerSpinManager {
  const items: SpinItem[] = [];
  const rpmBySprite = new Map<GenericSprite, number>();
  let _app: GenericApplication | null = null;
  let _isInitialized = false;
  let _performance: LayerModulePerformance = {};
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
  // Core implementation methods (init/tick/recompute/dispose)
  // ===================================================================

  const manager: LayerSpinManager = {
    // Required metadata properties
    name: "LayerSpinManager",
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
        rpmBySprite.clear();
        _isInitialized = false;

        // Process each layer with error handling
        for (const b of config.layers) {
          try {
            // Only handle basic RPM-based spin (clock-driven spin is handled by LayerClock)
            if (!b.cfg.clock?.enabled) {
              const rpm = clampRpm60(b.cfg.spinRPM);
              if (rpm > 0) {
                const dir = normalizeSpinDirection(b.cfg.spinDir);
                const baseRad = b.sprite.rotation;
                const radPerSec = calculateRadPerSec(rpm);

                const basicItem: BasicSpinItem = {
                  sprite: b.sprite,
                  baseRad,
                  radPerSec,
                  dir,
                  mode: "basic",
                };

                items.push(basicItem);
              }
              rpmBySprite.set(b.sprite, rpm);
            } else {
              // For clock-enabled sprites, set RPM to 0 since LayerClock handles them
              rpmBySprite.set(b.sprite, 0);
            }
          } catch (e) {
            const errorMsg = `Failed to create spin item for layer ${b.id}: ${e}`;
            warn("LayerSpin", errorMsg);
            warnings.push(errorMsg);
          }
        }

        _isInitialized = true;
        _performanceStats.initTime = performance.now() - startTime;
        _performanceStats.itemCount = items.length;

        debug("LayerSpin", `Initialized with ${items.length} spin items`);
        
        return { 
          success: true, 
          warnings: warnings.length > 0 ? warnings : undefined,
          data: undefined
        };
      } catch (e) {
        error("LayerSpin", `Initialization failed: ${e}`);
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
          // Basic RPM-based spin
          item.sprite.rotation = item.baseRad + item.dir * item.radPerSec * elapsed;
        }
        
        const duration = performance.now() - startTime;
        _performanceStats.lastTickDuration = duration;
        
        if (duration > maxTime && _performance.debugMode) {
          warn("LayerSpin", `Tick duration ${duration}ms exceeded limit ${maxTime}ms`);
        }

        return { success: true };
      } catch (e) {
        error("LayerSpin", `Tick failed: ${e}`);
        return { success: false, error: `Tick failed: ${e}` };
      }
    },

    recompute(): LayerModuleResult {
      if (!_isInitialized) {
        return { success: false, error: "Manager not initialized" };
      }

      const startTime = performance.now();
      
      try {
        // Basic spin doesn't need recomputation for resize events
        // All items maintain their rotation state
        
        _performanceStats.recomputeTime = performance.now() - startTime;
        debug("LayerSpin", `Recomputed ${items.length} spin items`);
        
        return { success: true };
      } catch (e) {
        error("LayerSpin", `Recompute failed: ${e}`);
        return { success: false, error: `Recompute failed: ${e}` };
      }
    },

    dispose(): LayerModuleResult {
      try {
        items.length = 0;
        rpmBySprite.clear();
        _app = null;
        _isInitialized = false;
        
        // Clear performance stats
        _performanceStats.initTime = 0;
        _performanceStats.tickTime = 0;
        _performanceStats.recomputeTime = 0;
        _performanceStats.itemCount = 0;
        _performanceStats.lastTickDuration = 0;
        
        debug("LayerSpin", "Manager disposed successfully");
        return { success: true };
      } catch (e) {
        error("LayerSpin", `Dispose failed: ${e}`);
        return { success: false, error: `Dispose failed: ${e}` };
      }
    },

    getSpinRpm(sprite: GenericSprite): number {
      return rpmBySprite.get(sprite) ?? 0;
    },

    getItems(): SpinItem[] {
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
// 🟡 BLOCK 6: DIAGNOSTICS AND DEBUG UTILITIES
// ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes debugging features)
// Provides debugging and diagnostic capabilities for spin system
// ===================================================================

export function getSpinDiagnostics(manager: LayerSpinManager): {
  itemCount: number;
  activeSprites: number;
  totalRpm: number;
} {
  const items = manager.getItems();
  const activeSprites = items.length;
  const totalRpm = items.reduce((sum, item) => {
    const rpm = (item.radPerSec * 30) / Math.PI;
    return sum + rpm;
  }, 0);

  return {
    itemCount: items.length,
    activeSprites,
    totalRpm: Math.round(totalRpm * 100) / 100,
  };
}

// ===================================================================
// 🟢 BLOCK 7: CONVENIENCE EXPORTS
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete (convenience only)
// Export functions and utilities for external use
// ===================================================================

// Export convenience functions
export function createSpinManager(): LayerSpinManager {
  return createLayerSpinManager();
}

// Utility functions now imported from LayerCreator.ts
