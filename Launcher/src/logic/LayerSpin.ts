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

// Import only core contracts from centralized location
import type { GenericSprite, GenericApplication, BuiltLayer } from "./LayerCreator";
import { clampRpm60, toDeg, toRad } from "./math";

// ===================================================================
// 🟢 BLOCK 1: UTILITY MATH FUNCTIONS
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete if not needed
// These are helper functions for RPM clamping and angle conversions
// ===================================================================
// Implemented via shared helpers in math.ts

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
export interface LayerSpinManager {
  init(app: GenericApplication, built: BuiltLayer[]): void;
  tick(elapsed: number): void;
  recompute(): void;
  dispose(): void;
  getSpinRpm(sprite: GenericSprite): number;
  getItems(): SpinItem[];
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

  // ===================================================================
  // 🔴 BLOCK 5: CORE IMPLEMENTATION
  // ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
  // Core implementation methods (init/tick/recompute/dispose)
  // ===================================================================

  return {
    init(application: GenericApplication, built: BuiltLayer[]) {
      _app = application;
      items.length = 0;
      rpmBySprite.clear();

      for (const b of built) {
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
      }
    },

    tick(elapsed: number) {
      for (const item of items) {
        // Basic RPM-based spin
        item.sprite.rotation = item.baseRad + item.dir * item.radPerSec * elapsed;
      }
    },

    recompute() {
      // Basic spin doesn't need recomputation for resize events
      // All items maintain their rotation state
    },

    dispose() {
      items.length = 0;
      rpmBySprite.clear();
      _app = null;
    },

    getSpinRpm(sprite: GenericSprite): number {
      return rpmBySprite.get(sprite) ?? 0;
    },

    getItems(): SpinItem[] {
      return [...items];
    },
  };
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
export { createLayerSpinManager as createSpinManager };

// Export utility functions for external access
export { clampRpm60, toRad, toDeg };
