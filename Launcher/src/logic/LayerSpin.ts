import type { Application, Sprite } from "pixi.js";
import type { BuiltLayer } from "./LogicTypes";
import { clampRpm60 } from "./LogicMath";

// Basic RPM-based spin item
export type BasicSpinItem = {
  sprite: Sprite;
  baseRad: number;
  radPerSec: number;
  dir: 1 | -1;
  mode: "basic";
};

export type SpinItem = BasicSpinItem;

// Basic spin manager for RPM-based spinning only
export interface LayerSpinManager {
  init(app: Application, built: BuiltLayer[]): void;
  tick(elapsed: number): void;
  recompute(): void;
  dispose(): void;
  getSpinRpm(sprite: Sprite): number;
  getItems(): SpinItem[];
}

// Create basic spin manager
export function createLayerSpinManager(): LayerSpinManager {
  const items: SpinItem[] = [];
  const rpmBySprite = new Map<Sprite, number>();
  let app: Application | null = null;

  return {
    init(application: Application, built: BuiltLayer[]) {
      app = application;
      items.length = 0;
      rpmBySprite.clear();

      for (const b of built) {
        // Only handle basic RPM-based spin (clock-driven spin is handled by LayerClock)
        if (!b.cfg.clock?.enabled) {
          const rpm = clampRpm60(b.cfg.spinRPM);
          if (rpm > 0) {
            const dir = b.cfg.spinDir === "ccw" ? -1 : (1 as 1 | -1);
            const baseRad = b.sprite.rotation;
            const radPerSec = (rpm * Math.PI) / 30;

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
      app = null;
    },

    getSpinRpm(sprite: Sprite): number {
      return rpmBySprite.get(sprite) ?? 0;
    },

    getItems(): SpinItem[] {
      return [...items];
    },
  };
}

// Export convenience functions
export function createSpinManager(): LayerSpinManager {
  return createLayerSpinManager();
}

// Re-export math utilities for convenience
export { clampRpm60 } from "./LogicMath";