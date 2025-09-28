import { Application, Assets, Container, Sprite } from "pixi.js";
import type { LogicConfig, LayerConfig, GenericSprite, GenericContainer, GenericApplication } from "./LayerCreator";

// Minimal shared types for the logic pipeline (hub + processors + adapters)
export type BuiltLayer = {
  id: string;
  sprite: GenericSprite;
  cfg: LayerConfig;
};

export type BuildResult = {
  container: GenericContainer;
  layers: BuiltLayer[];
};

export type BuildContext = {
  app: GenericApplication;
  container: GenericContainer;
  cfg: LogicConfig;
  layers: BuiltLayer[];
};

export interface LogicProcessor {
  init(ctx: BuildContext): void;
  onResize?(ctx: BuildContext): void;
  tick?(dt: number, ctx: BuildContext): void;
  dispose?(): void;
}

export interface LogicAdapter<M = unknown> {
  mount(root: HTMLElement, model: M): void;
  update?(model: M): void;
  dispose(): void;
}

// Engine interface following LayerSpin.ts pattern for rendering backends
export type EngineOptions = {
  // Allow backend-specific options
  [key: string]: unknown;
};

export type EngineHandle = {
  dispose(): void;
};

// Main Engine interface with lifecycle pattern similar to LayerSpinManager
export interface LogicEngine {
  init(root: HTMLElement, cfg: LogicConfig, opts?: EngineOptions): Promise<EngineHandle>;
  tick(elapsed: number): void;
  recompute(): void;
  dispose(): void;
}

import type { EffectHandler, LayerEffectManager } from "./LayerEffect";
import type {
  GlowSpec,
  BloomSpec,
  AdvancedEffectSpec
} from "./LayerEffect";
import { createLayerEffectManager } from "./LayerEffect";
import { createLayerSpinManager, type LayerSpinManager } from "./LayerSpin";
import { createLayerOrbitManager, type LayerOrbitManager } from "./LayerOrbit";
import { createLayerClockManager, type LayerClockManager } from "./LayerClock";
import {
  logicZIndexFor,
  logicApplyBasicTransform
} from "./LayerCreator";

// Math utilities and other helpers are now imported from LayerCreator.ts

// === PIXI APPLICATION DETECTION ===
export function isPixiApplication(app: any): boolean {
  return !!(app && typeof app === 'object' && 
           app.renderer && 
           app.stage && 
           app.ticker &&
           typeof app.render === 'function');
}

// === PIXI-SPECIFIC EFFECT HANDLER ===
export function createPixiEffectHandler(): EffectHandler {
  return {
    createAuraSprite(originalSprite: GenericSprite, spec: GlowSpec | BloomSpec): GenericSprite | null {
      const pixiSprite = originalSprite as Sprite;
      const auraSprite = new Sprite(pixiSprite.texture);
      auraSprite.anchor.set(0.5);
      
      if (spec.type === "glow") {
        auraSprite.tint = spec.color;
        auraSprite.alpha = spec.alpha;
      } else if (spec.type === "bloom") {
        auraSprite.alpha = Math.min(1, 0.3 + spec.strength * 0.4);
      }
      
      auraSprite.blendMode = 1; // BLEND_MODES.ADD
      
      const parent = pixiSprite.parent;
      if (parent) {
        const index = parent.getChildIndex(pixiSprite);
        parent.addChildAt(auraSprite, index);
      }
      
      return auraSprite as GenericSprite;
    },

    applyAdvancedEffect(_sprite: GenericSprite, _spec: AdvancedEffectSpec, _elapsed: number): void {
      // Advanced effects are handled in LayerEffect.ts tick method
      // This method is for any engine-specific advanced effect rendering
    },

    disposeAuraSprite(sprite: GenericSprite): void {
      const pixiSprite = sprite as Sprite;
      try {
        pixiSprite.destroy();
      } catch {
        // Ignore destroy errors
      }
    }
  };
}

// === PIXI-SPECIFIC SPRITE FACTORY ===
export function createPixiSpriteFactory(): any {
  return {
    async createSprite(url: string): Promise<GenericSprite> {
      const texture = await Assets.load(url);
      const sprite = new Sprite(texture);
      return sprite as GenericSprite;
    },

    createContainer(): any {
      return new Container();
    },

    async loadAssets(urls: string[]): Promise<void> {
      await Promise.all(
        urls.map((url) =>
          Assets.load(url).catch((e) => {
            console.warn("[EnginePixi] Preload failed for", url, e);
          })
        )
      );
    }
  };
}

// Spin manager now imported from LayerSpin.ts

// Orbit manager now imported from LayerOrbit.ts

// Effect manager now imported from LayerEffect.ts

// Clock manager now imported from LayerClock.ts

// Pixi-specific engine options
export type PixiEngineOptions = EngineOptions & {
  dprCap?: number;
  resizeTo?: Window | HTMLElement;
  backgroundAlpha?: number;
  antialias?: boolean;
};

// Internal state for the Pixi engine
type PixiEngineState = {
  app: Application;
  container: Container;
  layers: BuiltLayer[];
  spinManager: LayerSpinManager;
  clockManager: LayerClockManager;
  orbitManager: LayerOrbitManager;
  effectManager: LayerEffectManager;
  elapsed: number;
  resizeListener?: () => void;
  tickFunction?: () => void;
};

// Pixi engine implementation following LayerSpin.ts pattern
export interface PixiEngine extends LogicEngine {
  init(root: HTMLElement, cfg: LogicConfig, opts?: PixiEngineOptions): Promise<EngineHandle>;
  tick(elapsed: number): void;
  recompute(): void;
  dispose(): void;
  // Additional Pixi-specific methods
  getApplication(): Application | null;
  getContainer(): Container | null;
  getLayers(): BuiltLayer[];
  hasAnimations(): boolean;
}

// Utility function to get URL from image reference
function getUrlForImageRef(cfg: LogicConfig, ref: LayerConfig["imageRef"]): string | null {
  if (ref.kind === "url") return ref.url;
  const url = cfg.imageRegistry[ref.id];
  return url ?? null;
}

// Create Pixi engine implementation
export function createPixiEngine(): PixiEngine {
  let _state: PixiEngineState | null = null;
  let _root: HTMLElement | null = null;

  const engine = {
    async init(root: HTMLElement, cfg: LogicConfig, opts?: PixiEngineOptions): Promise<EngineHandle> {
      _root = root;
      
      // Create Pixi Application with options
      const dpr = Math.min(opts?.dprCap ?? 2, window.devicePixelRatio || 1);
      const app = new Application({
        resizeTo: opts?.resizeTo ?? window,
        backgroundAlpha: opts?.backgroundAlpha ?? 0,
        antialias: opts?.antialias ?? true,
        autoDensity: true,
        resolution: dpr,
      });

      // Mount canvas to DOM
      root.appendChild(app.view as HTMLCanvasElement);

      // Create main container
      const container = new Container();
      container.sortableChildren = true;
      app.stage.addChild(container);

      // Sort layers by z-index then id fallback, to define render order
      const layers = [...cfg.layers].sort((a, b) => {
        const za = logicZIndexFor(a);
        const zb = logicZIndexFor(b);
        if (za !== zb) return za - zb;
        return a.id.localeCompare(b.id);
      });

      const built: BuiltLayer[] = [];
      let warnedZ = false;

      // Prefetch assets in parallel to avoid sequential fetch latency
      const urlSet = new Set<string>();
      for (const layer of layers) {
        const u = getUrlForImageRef(cfg, layer.imageRef);
        if (u) urlSet.add(u);
      }
      try {
        await Promise.all(
          Array.from(urlSet).map((u) =>
            Assets.load(u).catch((e) => {
              console.warn("[EnginePixi] Preload failed for", u, e);
            }),
          ),
        );
      } catch {}

      // Create sprites for each layer
      for (const layer of layers) {
        // Warn once if legacy `z` is present and differs from ID-derived order
        const anyLayer = layer as unknown as { z?: number };
        if (!warnedZ && typeof anyLayer.z === "number") {
          const derived = logicZIndexFor(layer);
          if (anyLayer.z !== derived) {
            console.warn(
              "[EnginePixi] `z` is deprecated and ignored. Use numeric ID order. Layer:",
              layer.id,
              " legacy z:",
              anyLayer.z,
              " derived:",
              derived,
            );
          } else {
            console.warn(
              "[EnginePixi] `z` property is deprecated and ignored. Remove it from config. Layer:",
              layer.id,
            );
          }
          warnedZ = true;
        }

        const url = getUrlForImageRef(cfg, layer.imageRef);
        if (!url) {
          console.warn("[EnginePixi] Missing image URL for layer", layer.id, layer.imageRef);
          continue;
        }
        try {
          // Texture should be cached from prefetch; load again if needed
          const texture = await Assets.load(url);
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5);
          logicApplyBasicTransform(app, sprite, layer);
          // Set zIndex from ID-derived order only
          sprite.zIndex = logicZIndexFor(layer);
          container.addChild(sprite);
          built.push({ id: layer.id, sprite, cfg: layer });
        } catch (e) {
          console.error("[EnginePixi] Failed to load", url, "for layer", layer.id, e);
        }
      }

      // Initialize all managers
      const spinManager = createLayerSpinManager();
      spinManager.init(app, built);

      const clockManager = createLayerClockManager();
      clockManager.init(app, built);

      // Build RPM map for orbit system compatibility
      const spinRpmBySprite = new Map<Sprite, number>();
      for (const b of built) {
        spinRpmBySprite.set(b.sprite as Sprite, spinManager.getSpinRpm(b.sprite as Sprite));
      }

      const orbitManager = createLayerOrbitManager();
      orbitManager.init(app, built, spinRpmBySprite);

      // Effects (unified system with engine-specific handler)
      const effectHandler = createPixiEffectHandler();
      const effectManager = createLayerEffectManager(effectHandler);
      effectManager.init(app, built);

      // Create engine state
      _state = {
        app,
        container,
        layers: built,
        spinManager,
        clockManager,
        orbitManager,
        effectManager,
        elapsed: 0,
      };

      // Set up resize handling
      const onResize = () => {
        if (!_state) return;
        for (const b of built) logicApplyBasicTransform(app, b.sprite, b.cfg);
        _state.spinManager.recompute();
        _state.clockManager.recompute();
        _state.orbitManager.recompute(_state.elapsed);
        _state.effectManager.recompute();
      };
      const resizeListener = () => onResize();
      window.addEventListener("resize", resizeListener);
      _state.resizeListener = resizeListener;

      // Set up tick function
      const tick = () => {
        if (!_state) return;

        const spinItems = _state.spinManager.getItems();
        const clockItems = _state.clockManager.getItems();
        if (
          spinItems.length === 0 &&
          _state.orbitManager.getItems().length === 0 &&
          clockItems.length === 0 &&
          !_state.effectManager.hasEffects()
        )
          return;
        
        const dt = (app.ticker.deltaMS || 16.667) / 1000;
        _state.elapsed += dt;
        
        // Basic Spin (handles only basic RPM-based spins)
        _state.spinManager.tick(_state.elapsed);
        // Orbit
        _state.orbitManager.tick(_state.elapsed);
        // Clock (handles clock-driven spins and orbital motion)
        _state.clockManager.tick();
        // Effects (unified system)
        _state.effectManager.tick(_state.elapsed, built);
      };

      _state.tickFunction = tick;

      // Add ticker if we have animations
      try {
        if (engine.hasAnimations()) {
          app.ticker.add(tick);
        }
      } catch (e) {
        console.error("[EnginePixi] Error adding ticker:", e);
      }

      // Set up cleanup on container
      const prevCleanup = (container as any)._cleanup as (() => void) | undefined;
      (container as any)._cleanup = () => {
        engine.dispose();
        try {
          prevCleanup?.();
        } catch {}
      };

      // Return handle for external cleanup
      return {
        dispose() {
          engine.dispose();
        },
      };
    },

    tick(elapsed: number): void {
      if (!_state) return;
      _state.elapsed = elapsed;
      _state.tickFunction?.();
    },

    recompute(): void {
      if (!_state) return;
      
      for (const b of _state.layers) {
        logicApplyBasicTransform(_state.app, b.sprite, b.cfg);
      }
      
      _state.spinManager.recompute();
      _state.clockManager.recompute();
      _state.orbitManager.recompute(_state.elapsed);
      _state.effectManager.recompute();
    },

    dispose(): void {
      if (!_state) return;

      try {
        if (_state.resizeListener) {
          window.removeEventListener("resize", _state.resizeListener);
        }
      } catch {}
      
      try {
        if (_state.tickFunction) {
          _state.app.ticker.remove(_state.tickFunction);
        }
      } catch {}
      
      try {
        _state.spinManager.dispose();
      } catch {}
      
      try {
        _state.clockManager.dispose();
      } catch {}
      
      try {
        _state.effectManager.dispose();
      } catch {}
      
      try {
        _state.orbitManager.dispose();
      } catch {}

      try {
        if (_state.container) {
          try {
            (_state.container as any)._cleanup?.();
          } catch {}
          try {
            _state.container.destroy({ children: true });
          } catch {}
        }
      } finally {
        try {
          if (_root && _root.contains(_state.app.view as HTMLCanvasElement)) {
            _root.removeChild(_state.app.view as HTMLCanvasElement);
          }
        } catch {}
        _state.app.destroy(true, { children: true, texture: true, baseTexture: true });
      }

      _state = null;
      _root = null;
    },

    getApplication(): Application | null {
      return _state?.app ?? null;
    },

    getContainer(): Container | null {
      return _state?.container ?? null;
    },

    getLayers(): BuiltLayer[] {
      return _state?.layers ? [..._state.layers] : [];
    },

    hasAnimations(): boolean {
      if (!_state) return false;
      
      try {
        const spinItems = _state.spinManager.getItems();
        const clockItems = _state.clockManager.getItems();
        return (
          spinItems.length > 0 ||
          _state.orbitManager.getItems().length > 0 ||
          clockItems.length > 0 ||
          _state.effectManager.hasEffects()
        );
      } catch (e) {
        console.warn("[EnginePixi] Error checking animations:", e);
        return false;
      }
    },
  };
  
  return engine;
}

// === CONSOLIDATED LOGIC TICKER ===
export type RafTicker = {
  add(fn: (dt: number) => void): void;
  remove(fn: (dt: number) => void): void;
  start(): void;
  stop(): void;
  dispose(): void;
};

export function createRafTicker(): RafTicker {
  const subs = new Set<(dt: number) => void>();
  let running = false;
  let rafId = 0;
  let last = 0;

  const loop = (t: number) => {
    rafId = requestAnimationFrame(loop);
    const dt = last ? (t - last) / 1000 : 0;
    last = t;
    for (const fn of subs) fn(dt || 0);
  };

  return {
    add(fn) {
      subs.add(fn);
    },
    remove(fn) {
      subs.delete(fn);
    },
    start() {
      if (running) return;
      running = true;
      last = 0;
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(rafId);
      rafId = 0;
    },
    dispose() {
      this.stop();
      subs.clear();
    },
  };
}

// === CONSOLIDATED LOGIC LOADER ===
// Import LayerCreator types
import { createLayerCreatorManager } from "./LayerCreator";
import type { SpriteFactory } from "./LayerCreator";

// Simplified buildSceneFromLogic function that delegates to LayerCreator
export async function buildSceneFromLogic(
  app: GenericApplication,
  cfg: LogicConfig,
) {
  let spriteFactory: SpriteFactory | undefined;
  let effectHandler: EffectHandler | undefined;
  
  // Detect engine type and create appropriate factories
  if (isPixiApplication(app)) {
    try {
      spriteFactory = createPixiSpriteFactory();
      effectHandler = createPixiEffectHandler();
    } catch (e) {
      console.warn("[buildSceneFromLogic] Failed to create Pixi factories:", e);
    }
  } else {
    console.warn("[buildSceneFromLogic] Non-Pixi application detected");
  }
  
  const layerCreatorManager = createLayerCreatorManager(spriteFactory);
  return await layerCreatorManager.init(app, cfg, effectHandler);
}

// === CONSOLIDATED ENGINE ADAPTER ===
// Renderer type selection
export type RendererType = "pixi";

// Unified options type that supports both engines
export type EngineAdapterOptions = {
  // Pixi-specific options
  dprCap?: number;
  resizeTo?: Window | HTMLElement;
  backgroundAlpha?: number;
  antialias?: boolean;
} & EngineOptions;

// Adapter handle that matches the existing pattern
export type EngineAdapterHandle = {
  dispose(): void;
  getEngine(): LogicEngine | null;
  getRenderer(): RendererType;
};

/**
 * LogicEngineAdapter provides Pixi rendering functionality.
 * Simplified to support only Pixi backend.
 */
export class LogicEngineAdapter {
  private engine: LogicEngine | null = null;
  private renderer: RendererType = "pixi";
  private engineHandle: EngineHandle | null = null;

  /**
   * Initialize the adapter with the specified renderer type
   */
  async init(
    root: HTMLElement,
    cfg: LogicConfig,
    renderer: RendererType = "pixi",
    opts?: EngineAdapterOptions,
  ): Promise<EngineAdapterHandle> {
    try {
      // Clean up any existing engine
      this.dispose();

      this.renderer = renderer;

      // Create the appropriate engine based on renderer type
      if (renderer === "pixi") {
        this.engine = createPixiEngine();
        const pixiOpts: PixiEngineOptions = {
          dprCap: opts?.dprCap,
          resizeTo: opts?.resizeTo,
          backgroundAlpha: opts?.backgroundAlpha,
          antialias: opts?.antialias,
          ...opts,
        };
        this.engineHandle = await this.engine.init(root, cfg, pixiOpts);
      } else {
        throw new Error(`[LogicEngineAdapter] Unsupported renderer type: ${renderer}`);
      }

      // Return adapter handle
      return {
        dispose: () => this.dispose(),
        getEngine: () => this.engine,
        getRenderer: () => this.renderer,
      };
    } catch (error) {
      console.error(`[LogicEngineAdapter] Failed to initialize ${renderer} renderer:`, error);
      this.dispose();
      throw error;
    }
  }

  /**
   * Forward tick to the underlying engine
   */
  tick(elapsed: number): void {
    try {
      this.engine?.tick(elapsed);
    } catch (error) {
      console.error(`[LogicEngineAdapter] Error in ${this.renderer} tick:`, error);
    }
  }

  /**
   * Forward recompute to the underlying engine
   */
  recompute(): void {
    try {
      this.engine?.recompute();
    } catch (error) {
      console.error(`[LogicEngineAdapter] Error in ${this.renderer} recompute:`, error);
    }
  }

  /**
   * Dispose the current engine and clean up resources
   */
  dispose(): void {
    try {
      this.engineHandle?.dispose();
    } catch (error) {
      console.error(`[LogicEngineAdapter] Error disposing engine handle:`, error);
    }

    try {
      this.engine?.dispose();
    } catch (error) {
      console.error(`[LogicEngineAdapter] Error disposing ${this.renderer} engine:`, error);
    }

    this.engine = null;
    this.engineHandle = null;
  }

  /**
   * Get the current engine instance
   */
  getEngine(): LogicEngine | null {
    return this.engine;
  }

  /**
   * Get the current renderer type
   */
  getRenderer(): RendererType {
    return this.renderer;
  }

  /**
   * Check if the engine has animations that need ticking
   */
  hasAnimations(): boolean {
    try {
      if (this.renderer === "pixi" && this.engine) {
        const pixiEngine = this.engine as any;
        return pixiEngine.hasAnimations?.() ?? false;
      }
      // Only Pixi rendering is supported
      return false;
    } catch (error) {
      console.warn(`[LogicEngineAdapter] Error checking animations:`, error);
      return false;
    }
  }
}

/**
 * Create a new LogicEngineAdapter instance
 */
export function createLogicEngineAdapter(): LogicEngineAdapter {
  return new LogicEngineAdapter();
}

/**
 * Convenience function to mount a renderer (similar to mountPixi pattern)
 * This maintains compatibility with the existing mountPixi interface
 */
export async function mountRenderer(
  root: HTMLElement,
  cfg: LogicConfig,
  renderer: RendererType = "pixi",
  opts?: EngineAdapterOptions,
): Promise<EngineAdapterHandle> {
  const adapter = createLogicEngineAdapter();
  return await adapter.init(root, cfg, renderer, opts);
}

// LogicRenderer component removed - use LogicStage with Pixi directly

// Export convenience functions
export function createEngine(): PixiEngine {
  return createPixiEngine();
}

// Re-export utilities for convenience
export {
  toRad,
  toDeg,
  clamp,
  clamp01,
  normDeg,
  clampRpm60,
  logicZIndexFor,
  logicApplyBasicTransform
} from "./LayerCreator";