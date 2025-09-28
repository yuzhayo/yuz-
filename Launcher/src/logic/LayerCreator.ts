import type { LogicConfig, LayerConfig } from "./sceneTypes";
import type { BuiltLayer, BuildResult, GenericSprite, GenericApplication, GenericContainer } from "./LogicTypes";
import { logicApplyBasicTransform, logicZIndexFor } from "./LogicLoaderBasic";
import { createLayerSpinManager } from "./LayerSpin";
import type { LayerSpinManager } from "./LayerSpin";
import { createLayerClockManager } from "./LayerClock";
import type { LayerClockManager } from "./LayerClock";
import { createLayerOrbitManager } from "./LayerOrbit";
import type { LayerOrbitManager } from "./LayerOrbit";
import { createLayerEffectManager } from "./LayerEffect";
import type { LayerEffectManager, EffectHandler } from "./LayerEffect";

// Re-export EffectHandler for external use
export type { EffectHandler } from "./LayerEffect";

// Engine-agnostic type definitions for LayerCreator module
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

// Engine-agnostic manager interface for LayerCreator
export interface LayerCreatorManager {
  init(app: GenericApplication, cfg: LogicConfig, effectHandler?: EffectHandler): Promise<BuildResult>;
  tick(elapsed: number): void;
  recompute(): void;
  dispose(): void;
  getContainer(): GenericContainer;
  getLayers(): BuiltLayer[];
  hasAnimations(): boolean;
}

// Engine-specific sprite factory interface
export interface SpriteFactory {
  createSprite(url: string): Promise<GenericSprite>;
  createContainer(): GenericContainer;
  loadAssets(urls: string[]): Promise<void>;
}

// Utility function to get URL from image reference
function getUrlForImageRef(cfg: LogicConfig, ref: LayerConfig["imageRef"]): string | null {
  if (ref.kind === "url") return ref.url;
  const url = cfg.imageRegistry[ref.id];
  return url ?? null;
}

// Create LayerCreator manager implementation with pluggable sprite factory
export function createLayerCreatorManager(spriteFactory?: SpriteFactory): LayerCreatorManager {
  let _app: GenericApplication | null = null;
  let _container: GenericContainer | null = null;
  let _layers: BuiltLayer[] = [];
  let _managersState: LayerCreatorManagersState | null = null;

  const manager = {
    async init(app: GenericApplication, cfg: LogicConfig, effectHandler?: EffectHandler): Promise<BuildResult> {
      _app = app;
      _container = spriteFactory ? spriteFactory.createContainer() : ({ addChild: () => {}, children: [] } as GenericContainer);
      if (_container && typeof (_container as any).sortableChildren !== 'undefined') {
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
            console.warn("[logic] No sprite factory provided, skipping layer", layer.id);
            continue;
          }
          
          const sprite = await spriteFactory.createSprite(url);
          
          // Set anchor if supported (Pixi-specific)
          if (typeof (sprite as any).anchor?.set === 'function') {
            (sprite as any).anchor.set(0.5);
          }
          
          logicApplyBasicTransform(app, sprite, layer);
          
          // Add to container if it supports addChild
          if (_container && typeof _container.addChild === 'function') {
            _container.addChild(sprite);
          }
          
          built.push({ id: layer.id, sprite, cfg: layer });
        } catch (e) {
          console.error("[logic] Failed to load", url, "for layer", layer.id, e);
        }
      }

      _layers = built;

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

      // Set up resize handling
      const onResize = () => {
        for (const b of built) logicApplyBasicTransform(app, b.sprite, b.cfg);
        spinManager.recompute();
        clockManager.recompute();
        orbitManager.recompute(_managersState!.elapsed);
        effectManager.recompute();
      };
      const resizeListener = () => onResize();
      window.addEventListener("resize", resizeListener);
      _managersState.resizeListener = resizeListener;

      // Set up tick function
      const tick = () => {
        if (!_managersState) return;

        const spinItems = spinManager.getItems();
        const clockItems = clockManager.getItems();
        if (
          spinItems.length === 0 &&
          orbitManager.getItems().length === 0 &&
          clockItems.length === 0 &&
          !effectManager.hasEffects()
        )
          return;
        
        const dt = ((app as any).ticker?.deltaMS || 16.667) / 1000;
        _managersState.elapsed += dt;
        
        // Basic Spin (handles only basic RPM-based spins)
        spinManager.tick(_managersState.elapsed);
        // Orbit
        orbitManager.tick(_managersState.elapsed);
        // Clock (handles clock-driven spins and orbital motion)
        clockManager.tick();
        // Effects (unified system)
        effectManager.tick(_managersState.elapsed, built);
      };

      _managersState.tickFunction = tick;

      // Add ticker if we have animations
      try {
        if (manager.hasAnimations() && (app as any).ticker?.add) {
          (app as any).ticker.add(tick);
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
      if (!_app || !_managersState) return;
      
      for (const b of _layers) {
        logicApplyBasicTransform(_app, b.sprite, b.cfg);
      }
      
      _managersState.spinManager.recompute();
      _managersState.clockManager.recompute();
      _managersState.orbitManager.recompute(_managersState.elapsed);
      _managersState.effectManager.recompute();
    },

    dispose(): void {
      if (!_managersState) return;

      try {
        if (_managersState.resizeListener) {
          window.removeEventListener("resize", _managersState.resizeListener);
        }
      } catch {}
      
      try {
        if (_app && _managersState.tickFunction && (_app as any).ticker?.remove) {
          (_app as any).ticker.remove(_managersState.tickFunction);
        }
      } catch {}
      
      try {
        _managersState.spinManager.dispose();
      } catch {}
      
      try {
        _managersState.clockManager.dispose();
      } catch {}
      
      try {
        _managersState.effectManager.dispose();
      } catch {}
      
      try {
        _managersState.orbitManager.dispose();
      } catch {}

      _managersState = null;
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

// Export convenience functions
export function createCreatorManager(): LayerCreatorManager {
  return createLayerCreatorManager();
}

// Re-export utilities for convenience
export { logicZIndexFor, logicApplyBasicTransform } from "./LogicLoaderBasic";