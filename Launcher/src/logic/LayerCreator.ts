/**
 * LayerCreator.ts - Modular Layer Processing System
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
import { createLayerSpinManager } from "./LayerSpin";
import type { LayerSpinManager } from "./LayerSpin";
import { createLayerClockManager } from "./LayerClock";
import type { LayerClockManager } from "./LayerClock";
import { createLayerOrbitManager } from "./LayerOrbit";
import type { LayerOrbitManager } from "./LayerOrbit";
import { createLayerEffectManager } from "./LayerEffect";
import type { LayerEffectManager, EffectHandler } from "./LayerEffect";

// Import all contracts from centralized location
import type {
  ImageRegistry,
  ImageRef,
  RendererMode,
  GenericSprite,
  GenericContainer,
  GenericApplication,
  LayerConfig,
  BuiltLayer,
  BuildResult,
  LogicConfig,
  SpriteFactory,
  // LayerModule and PluginRegistry are for future extensibility
  LayerModule as _LayerModule,
  PluginRegistry as _PluginRegistry,
} from "./LayerContracts";

// Re-export all types for backward compatibility
export type {
  ImageRegistry,
  ImageRef,
  RendererMode,
  GenericSprite,
  GenericContainer,
  GenericApplication,
  LayerConfig,
  BuiltLayer,
  BuildResult,
  LogicConfig,
  SpriteFactory,
  EffectHandler,
};

// ===================================================================
// 🟢 BLOCK 1: UTILITY MATH FUNCTIONS
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete if not needed
// These are helper functions for angle/value conversions
// ===================================================================

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
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

// ===================================================================
// 🔴 BLOCK 2: CORE LAYER TRANSFORM FUNCTIONS
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// These functions handle basic layer positioning and z-ordering
// ===================================================================

function logicZIndexFor(cfg: LayerConfig): number {
  const m = cfg.id.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function logicApplyBasicTransform(app: GenericApplication, sp: GenericSprite, cfg: LayerConfig) {
  const w = STAGE_WIDTH;
  const h = STAGE_HEIGHT;
  const xPct = cfg.position.xPct ?? 0;
  const yPct = cfg.position.yPct ?? 0;
  sp.x = (xPct / 100) * w;
  sp.y = (yPct / 100) * h;
  const s = (cfg.scale?.pct ?? 100) / 100;
  if (typeof sp.scale === "object" && "set" in sp.scale && typeof sp.scale.set === "function") {
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

// ===================================================================
// 🔴 BLOCK 3: CONFIG PROCESSING
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Handles JSON config reading and image URL resolution
// ===================================================================

function getUrlForImageRef(cfg: LogicConfig, ref: LayerConfig["imageRef"]): string | null {
  if (ref.kind === "url") return ref.url;
  const url = cfg.imageRegistry[ref.id];
  return url ?? null;
}

// ===================================================================
// 🟡 BLOCK 4: ANIMATION MANAGERS STATE
// ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes animations)
// Manages spin, orbit, clock, and effect animations
// ===================================================================

export type LayerCreatorItem = {
  id: string;
  sprite: GenericSprite;
  cfg: LayerConfig;
};

export type LayerCreatorManagersState = {
  spinManager: LayerSpinManager;
  clockManager: LayerClockManager;
  orbitManager: LayerOrbitManager;
  effectManager: LayerEffectManager;
  elapsed: number;
  resizeListener?: () => void;
  tickFunction?: () => void;
};

// ===================================================================
// 🔴 BLOCK 5: CORE MANAGER INTERFACE
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Main interface that external code depends on
// ===================================================================

export interface LayerCreatorManager {
  init(
    app: GenericApplication,
    cfg: LogicConfig,
    effectHandler?: EffectHandler,
  ): Promise<BuildResult>;
  tick(elapsed: number): void;
  recompute(): void;
  dispose(): void;
  getContainer(): GenericContainer;
  getLayers(): BuiltLayer[];
  hasAnimations(): boolean;
}

// ===================================================================
// 🔴 BLOCK 6: CORE LAYER CREATOR IMPLEMENTATION
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Main implementation that creates and manages layers
// ===================================================================

export function createLayerCreatorManager(spriteFactory?: SpriteFactory): LayerCreatorManager {
  let _app: GenericApplication | null = null;
  let _container: GenericContainer | null = null;
  let _layers: BuiltLayer[] = [];
  let _managersState: LayerCreatorManagersState | null = null;
  let _resizeListener: (() => void) | null = null;
  let _tickFunction: (() => void) | null = null;

  const manager = {
    async init(
      app: GenericApplication,
      cfg: LogicConfig,
      effectHandler?: EffectHandler,
    ): Promise<BuildResult> {
      _app = app;
      _container = spriteFactory
        ? spriteFactory.createContainer()
        : {
            children: [] as GenericSprite[],
            addChild: function(child: GenericSprite) {
              this.children.push(child);
            }
          } as GenericContainer;
      if (_container && typeof (_container as any).sortableChildren !== "undefined") {
        (_container as any).sortableChildren = true;
      }
      _layers = [];

      // Sort layers by z-index then id fallback, to define render order
      const layers = [...cfg.layers].sort((a, b) => {
        const za = logicZIndexFor(a);
        const zb = logicZIndexFor(b);
        if (za !== zb) return za - zb;
        return a.id.localeCompare(b.id);
      });

      const built: BuiltLayer[] = [];
      let warnedZ = false;

      // Prefetch assets using sprite factory if available
      const urlSet = new Set<string>();
      for (const layer of layers) {
        const u = getUrlForImageRef(cfg, layer.imageRef);
        if (u) urlSet.add(u);
      }
      if (spriteFactory && urlSet.size > 0) {
        try {
          await spriteFactory.loadAssets(Array.from(urlSet));
        } catch (e) {
          console.warn("[logic] Asset preloading failed", e);
        }
      }

      // Create sprites for each layer
      for (const layer of layers) {
        // Warn once if legacy `z` is present and differs from ID-derived order
        const anyLayer = layer as unknown as { z?: number };
        if (!warnedZ && typeof anyLayer.z === "number") {
          const derived = logicZIndexFor(layer);
          if (anyLayer.z !== derived) {
            console.warn(
              "[logic] `z` is deprecated and ignored. Use numeric ID order. Layer:",
              layer.id,
              " legacy z:",
              anyLayer.z,
              " derived:",
              derived,
            );
          } else {
            console.warn(
              "[logic] `z` property is deprecated and ignored. Remove it from config. Layer:",
              layer.id,
            );
          }
          warnedZ = true;
        }

        const url = getUrlForImageRef(cfg, layer.imageRef);
        if (!url) {
          console.warn("[logic] Missing image URL for layer", layer.id, layer.imageRef);
          continue;
        }
        try {
          if (!spriteFactory) {
            console.warn("[logic] No sprite factory provided, creating placeholder for layer", layer.id);
            // Create a basic placeholder sprite structure for compatibility
            const sprite = {
              x: 0,
              y: 0,
              rotation: 0,
              alpha: 1,
              scale: { x: 1, y: 1, set: (x: number, y: number) => { sprite.scale.x = x; sprite.scale.y = y; } },
              zIndex: 0,
            } as GenericSprite;
            
            logicApplyBasicTransform(app, sprite, layer);
            
            // Add to container even for placeholder sprites
            if (_container && typeof _container.addChild === "function") {
              _container.addChild(sprite);
            }
            
            built.push({ id: layer.id, sprite, cfg: layer });
            continue;
          }

          const sprite = await spriteFactory.createSprite(url);

          // Set anchor if supported (Pixi-specific)
          if (typeof (sprite as any).anchor?.set === "function") {
            (sprite as any).anchor.set(0.5);
          }

          logicApplyBasicTransform(app, sprite, layer);

          // Add to container if it supports addChild
          if (_container && typeof _container.addChild === "function") {
            _container.addChild(sprite);
          }

          built.push({ id: layer.id, sprite, cfg: layer });
        } catch (e) {
          console.error("[logic] Failed to load", url, "for layer", layer.id, e);
        }
      }

      _layers = built;

      // ===================================================================
      // 🟡 BLOCK 7: ANIMATION MANAGERS INITIALIZATION
      // ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes animations)
      // ===================================================================

      // Initialize all managers
      const spinManager = createLayerSpinManager();
      spinManager.init(app, built);

      const clockManager = createLayerClockManager();
      clockManager.init(app, built);

      // Build RPM map for orbit system compatibility
      const spinRpmBySprite = new Map<GenericSprite, number>();
      for (const b of built) {
        spinRpmBySprite.set(b.sprite, spinManager.getSpinRpm(b.sprite));
      }

      const orbitManager = createLayerOrbitManager();
      orbitManager.init(app, built, spinRpmBySprite);

      // Effects (unified system)
      const effectManager = createLayerEffectManager(effectHandler);
      effectManager.init(app, built);

      // Create managers state
      _managersState = {
        spinManager,
        clockManager,
        orbitManager,
        effectManager,
        elapsed: 0,
      };

      // ===================================================================
      // 🟡 BLOCK 8: LIFECYCLE HOOKS (RESIZE/TICKER)
      // ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes auto-updates)
      // ===================================================================

      // Set up resize handling
      const onResize = () => {
        for (const b of built) logicApplyBasicTransform(app, b.sprite, b.cfg);
        if (_managersState) {
          _managersState.spinManager?.recompute();
          _managersState.clockManager?.recompute();
          _managersState.orbitManager?.recompute(_managersState.elapsed);
          _managersState.effectManager?.recompute();
        }
      };
      _resizeListener = () => onResize();
      window.addEventListener("resize", _resizeListener);
      if (_managersState) {
        _managersState.resizeListener = _resizeListener;
      }

      // Set up tick function
      const tick = () => {
        if (!_managersState) return;

        const spinItems = _managersState.spinManager?.getItems() || [];
        const clockItems = _managersState.clockManager?.getItems() || [];
        const orbitItems = _managersState.orbitManager?.getItems() || [];
        const hasEffects = _managersState.effectManager?.hasEffects() || false;
        
        if (spinItems.length === 0 && orbitItems.length === 0 && clockItems.length === 0 && !hasEffects) {
          return;
        }

        const dt = ((app as any).ticker?.deltaMS || 16.667) / 1000;
        _managersState.elapsed += dt;

        // Basic Spin (handles only basic RPM-based spins)
        _managersState.spinManager?.tick(_managersState.elapsed);
        // Orbit
        _managersState.orbitManager?.tick(_managersState.elapsed);
        // Clock (handles clock-driven spins and orbital motion)
        _managersState.clockManager?.tick();
        // Effects (unified system)
        _managersState.effectManager?.tick(_managersState.elapsed, built);
      };

      _tickFunction = tick;
      if (_managersState) {
        _managersState.tickFunction = _tickFunction;
      }

      // Add ticker if we have animations
      try {
        if (manager.hasAnimations() && (app as any).ticker?.add) {
          (app as any).ticker.add(_tickFunction);
        }
      } catch (e) {
        console.error("[LayerCreator] Error adding ticker:", e);
      }

      // Set up cleanup on container
      const prevCleanup = (_container as any)._cleanup as (() => void) | undefined;
      (_container as any)._cleanup = () => {
        manager.dispose();
        try {
          prevCleanup?.();
        } catch {}
      };

      return { container: _container, layers: built };
    },

    tick(elapsed: number): void {
      if (!_managersState) return;
      _managersState.elapsed = elapsed;
      _managersState.tickFunction?.();
    },

    recompute(): void {
      if (!_app) return;

      // Always recompute basic transforms for all layers
      for (const b of _layers) {
        logicApplyBasicTransform(_app, b.sprite, b.cfg);
      }

      // Recompute animation managers only if they exist
      if (_managersState) {
        _managersState.spinManager?.recompute();
        _managersState.clockManager?.recompute();
        _managersState.orbitManager?.recompute(_managersState.elapsed);
        _managersState.effectManager?.recompute();
      }
    },

    dispose(): void {
      // Always clean up event listeners first
      try {
        if (_resizeListener) {
          window.removeEventListener("resize", _resizeListener);
          _resizeListener = null;
        }
      } catch {}

      try {
        if (_app && _tickFunction && (_app as any).ticker?.remove) {
          (_app as any).ticker.remove(_tickFunction);
        }
        _tickFunction = null;
      } catch {}

      // Clean up animation managers if they exist
      if (_managersState) {
        try {
          _managersState.spinManager?.dispose();
        } catch {}

        try {
          _managersState.clockManager?.dispose();
        } catch {}

        try {
          _managersState.effectManager?.dispose();
        } catch {}

        try {
          _managersState.orbitManager?.dispose();
        } catch {}

        _managersState = null;
      }

      // Always clean up core resources regardless of animation managers
      _app = null;
      _container = null;
      _layers = [];
    },

    getContainer(): GenericContainer {
      if (!_container) {
        throw new Error("[LayerCreator] Container not initialized");
      }
      return _container;
    },

    getLayers(): BuiltLayer[] {
      return [..._layers];
    },

    hasAnimations(): boolean {
      if (!_managersState) return false;

      try {
        const spinItems = _managersState.spinManager.getItems();
        const clockItems = _managersState.clockManager.getItems();
        return (
          spinItems.length > 0 ||
          _managersState.orbitManager.getItems().length > 0 ||
          clockItems.length > 0 ||
          _managersState.effectManager.hasEffects()
        );
      } catch (e) {
        console.warn("[LayerCreator] Error checking animations:", e);
        return false;
      }
    },
  };

  return manager;
}

// ===================================================================
// 🟢 BLOCK 9: CONVENIENCE EXPORTS
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete (convenience only)
// Export functions for external use
// ===================================================================

export function createCreatorManager(): LayerCreatorManager {
  return createLayerCreatorManager();
}

// Export utilities for external access
export {
  toRad,
  toDeg,
  clamp,
  clamp01,
  clampRpm60,
  normDeg,
  logicZIndexFor,
  logicApplyBasicTransform,
};