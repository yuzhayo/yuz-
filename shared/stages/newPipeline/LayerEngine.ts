/**
 * LayerEngine.ts - Complete Scene Building System for New Pipeline
 * 
 * This file provides a complete scene building system that can take layer configurations
 * and generate Pixi.js rendered scenes with all animation managers.
 * 
 * Extracted from LayerCreator.ts with:
 * - Stage/Pixi Factory Logic (createStage2048, createPixiApplication)
 * - Layer Creator Manager (createLayerCreatorManager, createPixiFactories)
 * - Pixi Factories and Guards (isPixiApplication, sprite/effect factories)
 * - Scene-Building APIs (buildSceneFromLogic, createPixiEngine)
 */

// ===================================================================
// IMPORTS
// ===================================================================

// Import config types from LayerConfig.ts
import type { 
  LogicConfig, 
  LayerConfig, 
  ImageRegistry, 
  ImageRef 
} from './LayerConfig';

// Import manager contracts and math helpers from LayerCore.ts
import type { 
  StageTransform, 
  StageCoordinates 
} from './LayerCore';
import { 
  STAGE_WIDTH, 
  STAGE_HEIGHT, 
  STAGE_CSS,
  StageTransformManager,
  calculateStageTransform,
  transformCoordinatesToStage,
  isWithinStage,
  ensureStageStyles,
  toRad
} from './LayerCore';

// Import Pixi.js types
import { Application, Assets, Container, Sprite } from "pixi.js";

// Import animation managers from local LayerCore.ts
import { 
  createLayerSpinManager, 
  createLayerClockManager, 
  createLayerOrbitManager, 
  createLayerEffectManager 
} from "./LayerCore";
import type { 
  LayerSpinManager, 
  LayerClockManager, 
  LayerOrbitManager, 
  LayerEffectManager, 
  EffectHandler, 
  GlowSpec, 
  BloomSpec, 
  AdvancedEffectSpec 
} from "./LayerCore";

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

// Engine-agnostic interfaces for cross-renderer compatibility
export interface GenericSprite {
  x: number;
  y: number;
  rotation: number;
  alpha: number;
  scale: {
    x: number;
    y: number;
    set?: (x: number, y: number) => void;
  };
  zIndex?: number;
}

export interface GenericContainer {
  addChild: (child: GenericSprite) => void;
  children: GenericSprite[];
}

export interface GenericApplication {
  ticker?: {
    deltaMS?: number;
    add?: (fn: () => void) => void;
    remove?: (fn: () => void) => void;
  };
}

// Build result types
export interface BuiltLayer {
  id: string;
  sprite: GenericSprite;
  cfg: LayerConfig;
}

export interface BuildResult {
  container: GenericContainer;
  layers: BuiltLayer[];
}

// Sprite factory interface for renderer abstraction
export interface SpriteFactory {
  createSprite(url: string): Promise<GenericSprite>;
  createContainer(): GenericContainer;
  loadAssets(urls: string[]): Promise<void>;
}

// Stage2048 Types
export interface Stage2048Options {
  /** Enable debug overlay */
  debug?: boolean;
  /** Device pixel ratio cap */
  dprCap?: number;
  /** Background alpha for Pixi canvas */
  backgroundAlpha?: number;
  /** Enable antialiasing */
  antialias?: boolean;
  /** Inject CSS styles automatically */
  autoInjectCSS?: boolean;
}

export interface Stage2048Instance {
  /** Pixi Application instance */
  app: any; // Using any to avoid direct Pixi dependency
  /** Transform manager for coordinate conversion */
  transformManager: StageTransformManager;
  /** Get the overlay element for gesture handling */
  getOverlay(): HTMLElement | null;
  /** Get current transform data */
  getTransform(): StageTransform | null;
  /** Transform event coordinates to stage coordinates */
  transformEventCoordinates(event: PointerEvent | MouseEvent | TouchEvent): StageCoordinates | null;
  /** Clean up and dispose resources */
  dispose(): void;
}

// Pixi Engine Types
export type PixiEngineOptions = {
  dprCap?: number;
  resizeTo?: Window | HTMLElement;
  backgroundAlpha?: number;
  antialias?: boolean;
};

export type EngineHandle = {
  dispose(): void;
};

export interface PixiEngine {
  init(root: HTMLElement, cfg: LogicConfig, opts?: PixiEngineOptions): Promise<EngineHandle>;
  tick(elapsed: number): void;
  recompute(): void;
  dispose(): void;
  getApplication(): Application | null;
  getContainer(): GenericContainer | null;
  getLayers(): BuiltLayer[];
  hasAnimations(): boolean;
}

// Layer Creator Manager Types
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
// CORE LAYER TRANSFORM FUNCTIONS
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

function getUrlForImageRef(cfg: LogicConfig, ref: LayerConfig["imageRef"]): string | null {
  if (ref.kind === "url") return ref.url;
  const url = cfg.imageRegistry[ref.id];
  return url ?? null;
}

// ===================================================================
// PIXI FACTORIES AND GUARDS
// ===================================================================

/**
 * Pixi Application Detection Guard
 */
export function isPixiApplication(app: any): boolean {
  return !!(
    app &&
    typeof app === "object" &&
    app.renderer &&
    app.stage &&
    app.ticker &&
    typeof app.render === "function"
  );
}

/**
 * Consolidated Pixi Factories (formerly createPixiSpriteFactory and createPixiEffectHandler)
 */
export function createPixiFactories(): { spriteFactory: SpriteFactory; effectHandler: EffectHandler } {
  // Sprite Factory implementation (formerly createPixiSpriteFactory)
  const spriteFactory: SpriteFactory = {
    async createSprite(url: string): Promise<GenericSprite> {
      const texture = await Assets.load(url);
      const sprite = new Sprite(texture);
      return sprite as GenericSprite;
    },

    createContainer(): GenericContainer {
      return new Container() as GenericContainer;
    },

    async loadAssets(urls: string[]): Promise<void> {
      await Promise.all(
        urls.map((url) =>
          Assets.load(url).catch((e) => {
            console.warn("[EnginePixi] Preload failed for", url, e);
          }),
        ),
      );
    },
  };

  // Effect Handler implementation (formerly createPixiEffectHandler)
  const effectHandler: EffectHandler = {
    createAuraSprite(
      originalSprite: GenericSprite,
      spec: GlowSpec | BloomSpec,
    ): GenericSprite | null {
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
    },
  };

  return { spriteFactory, effectHandler };
}

// ===================================================================
// LAYER CREATOR MANAGER
// ===================================================================

/**
 * Create animation managers for the layer system
 */
function createAnimationManagers(
  app: GenericApplication,
  effectHandler?: EffectHandler,
): LayerCreatorManagersState {
  return {
    spinManager: createLayerSpinManager(),
    clockManager: createLayerClockManager(),
    orbitManager: createLayerOrbitManager(),
    effectManager: createLayerEffectManager(effectHandler),
    elapsed: 0,
  };
}

/**
 * Create Layer Creator Manager
 */
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
              "[logic] `z` is deprecated and redundant. Use numeric ID order. Layer:",
              layer.id,
            );
          }
          warnedZ = true;
        }

        const url = getUrlForImageRef(cfg, layer.imageRef);
        if (!url) {
          console.warn("[logic] No URL for layer", layer.id, layer.imageRef);
          continue;
        }

        let sprite: GenericSprite;
        try {
          if (spriteFactory) {
            sprite = await spriteFactory.createSprite(url);
          } else {
            // Fallback for basic compatibility
            sprite = {
              x: 0,
              y: 0,
              rotation: 0,
              alpha: 1,
              scale: { x: 1, y: 1 },
              zIndex: 0,
            };
          }
        } catch (e) {
          console.warn("[logic] Failed to create sprite for", layer.id, e);
          continue;
        }

        // Apply basic transforms
        logicApplyBasicTransform(app, sprite, layer);

        // Add to container
        _container.addChild(sprite);

        // Store built layer
        const builtLayer: BuiltLayer = { id: layer.id, sprite, cfg: layer };
        built.push(builtLayer);
      }

      _layers = built;

      // Initialize animation managers if any layers have animation properties
      const hasAnimations = layers.some(
        (layer) =>
          layer.spinRPM || layer.orbitRPM || layer.clock || layer.effects
      );

      if (hasAnimations) {
        _managersState = createAnimationManagers(app, effectHandler);

        // Initialize animation managers with all built layers
        _managersState.spinManager.init(app, built);
        _managersState.clockManager.init(app, built);
        _managersState.orbitManager.init(app, built);
        _managersState.effectManager.init(app, built);

        // Setup tick function for animation updates
        _tickFunction = () => {
          if (_managersState && _app) {
            const deltaMs = (_app.ticker?.deltaMS) ?? 16.67;
            _managersState.elapsed += deltaMs;
            manager.tick(deltaMs);
          }
        };

        if ((_app as any).ticker?.add && _tickFunction) {
          (_app as any).ticker.add(_tickFunction);
        }

        // Setup resize listener for responsive updates
        _resizeListener = () => {
          manager.recompute();
        };
        window.addEventListener("resize", _resizeListener);
      }

      return { container: _container, layers: built };
    },

    tick(elapsed: number): void {
      if (!_managersState) return;

      _managersState.elapsed += elapsed;

      try {
        _managersState.spinManager?.tick(elapsed);
        _managersState.clockManager?.tick();
        _managersState.orbitManager?.tick(elapsed);
        _managersState.effectManager?.tick(elapsed, _layers);
      } catch (e) {
        console.warn("[LayerCreator] Animation tick error:", e);
      }
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
// STAGE/PIXI FACTORY LOGIC
// ===================================================================

/**
 * Create just the Pixi application with correct dimensions
 */
export function createPixiApplication(
  options: Stage2048Options = {},
  PixiApplication: any = Application,
  appOverrides: Record<string, unknown> = {},
) {
  const dpr = Math.min(options.dprCap ?? 2, window.devicePixelRatio || 1);

  // Check for Canvas support first
  if (typeof document === 'undefined' || !document.createElement) {
    throw new Error("Document context not available for Canvas creation");
  }

  // Test canvas creation
  try {
    const testCanvas = document.createElement('canvas');
    if (!testCanvas.getContext) {
      throw new Error("Canvas context not supported");
    }
  } catch (error) {
    throw new Error(`Canvas test failed: ${error}`);
  }

  const baseConfig = {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    backgroundAlpha: options.backgroundAlpha ?? 0,
    antialias: options.antialias ?? true,
    resolution: dpr,
    hello: false,
    ...appOverrides,
  };

  // Define fallback configurations to try in order
  const fallbackConfigs = [
    {
      name: "WebGL",
      config: { ...baseConfig, preference: "webgl" }
    },
    {
      name: "Canvas", 
      config: { ...baseConfig, forceCanvas: true }
    },
    {
      name: "Minimal",
      config: { width: STAGE_WIDTH, height: STAGE_HEIGHT, hello: false }
    }
  ];

  console.log("[createPixiApplication] Attempting Pixi Application creation");
  let lastError: unknown = null;

  // Try each configuration in order
  for (const { name, config } of fallbackConfigs) {
    try {
      console.log(`[createPixiApplication] Trying with ${name} preference`);
      return new PixiApplication(config);
    } catch (error) {
      console.warn(`[createPixiApplication] ${name} failed:`, error);
      lastError = error;
    }
  }

  // If all standard attempts failed, create a mock application
  console.warn("[createPixiApplication] All standard attempts failed, creating mock application");
  
  const canvas = document.createElement('canvas');
  canvas.width = STAGE_WIDTH;
  canvas.height = STAGE_HEIGHT;
  
  const mockApp = {
    view: canvas,
    renderer: {
      type: 1, // RENDERER_TYPE.CANVAS
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      resolution: 1,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
    },
    stage: {
      addChild: () => {},
      removeChild: () => {},
      children: [],
    },
    ticker: {
      add: () => {},
      remove: () => {},
      start: () => {},
      stop: () => {},
      deltaMS: 16.67,
    },
    destroy: () => {},
    render: () => {},
    screen: { x: 0, y: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT },
  };
  
  console.log("[createPixiApplication] Mock application created for compatibility");
  return mockApp as any;
}

/**
 * Create a complete Stage2048 system with Pixi.js integration
 *
 * This is the main factory function that sets up everything you need:
 * - CSS injection
 * - Pixi Application creation
 * - DOM structure setup
 * - Transform management
 * - Coordinate transformation
 *
 * @param rootElement - The root element to mount the stage
 * @param options - Configuration options
 * @param PixiApplication - Pixi Application constructor (injected to avoid direct dependency)
 * @returns Promise resolving to Stage2048Instance
 */
export async function createStage2048(
  rootElement: HTMLElement,
  options: Stage2048Options = {},
  PixiApplication?: any,
): Promise<Stage2048Instance> {
  // Inject CSS if enabled (default: true)
  if (options.autoInjectCSS !== false) {
    ensureStageStyles();
  }

  // Create transform manager
  const transformManager = new StageTransformManager(options.debug);

  const applicationCtor = PixiApplication ?? Application;
  const baseOverrides: Record<string, unknown> = {
    backgroundAlpha: options.backgroundAlpha ?? 0.1,
    antialias: options.antialias ?? false,
    autoDensity: false,
    resolution: 1,
    powerPreference: "low-power",
    hello: false,
  };

  let app: any;
  let webglError: unknown = null;

  try {
    app = createPixiApplication(options, applicationCtor, baseOverrides);
  } catch (err) {
    webglError = err;
    console.warn("[Stage2048] WebGL renderer failed, trying canvas fallback", err);
    try {
      app = createPixiApplication(options, applicationCtor, {
        ...baseOverrides,
        preference: "canvas",
        antialias: false,
      });
    } catch (canvasError) {
      console.error("[Stage2048] Canvas renderer fallback also failed", canvasError);
      throw (webglError ?? canvasError);
    }
  }

  // Create container and overlay structure
  const container = document.createElement("div");
  const overlay = document.createElement("div");

  // Setup DOM structure
  rootElement.classList.add("stage-cover-root");
  rootElement.appendChild(container);
  container.appendChild(app.view as HTMLCanvasElement);
  container.appendChild(overlay);

  // Initialize transform system
  transformManager.initialize(container, app.view as HTMLCanvasElement, overlay);

  // Return complete Stage2048Instance
  return {
    app,
    transformManager,

    getOverlay(): HTMLElement | null {
      return (container?.querySelector(".stage-cover-overlay") as HTMLElement) || null;
    },

    getTransform(): StageTransform | null {
      return transformManager.getTransform();
    },

    transformEventCoordinates(
      event: PointerEvent | MouseEvent | TouchEvent,
    ): StageCoordinates | null {
      return transformManager.transformEventCoordinates(event);
    },

    dispose() {
      if (app) {
        try {
          // Remove canvas from DOM
          const canvas = app.view as HTMLCanvasElement;
          if (container && container.contains(canvas)) {
            container.removeChild(canvas);
          }
        } catch (e) {
          console.warn("Failed to remove canvas from DOM:", e);
        }

        // Destroy Pixi app
        app.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true,
        });
      }

      // Clean up container
      if (container?.parentElement) {
        container.parentElement.removeChild(container);
      }

      // Dispose transform manager
      transformManager.dispose();
    },
  };
}

// ===================================================================
// SCENE-BUILDING APIs
// ===================================================================

/**
 * Build scene from logic configuration - main function used by Stage2048 component
 */
export async function buildSceneFromLogic(
  app: GenericApplication,
  cfg: LogicConfig,
): Promise<BuildResult> {
  let spriteFactory: SpriteFactory | undefined;
  let effectHandler: EffectHandler | undefined;

  // Detect engine type and create appropriate factories
  if (isPixiApplication(app)) {
    try {
      const factories = createPixiFactories();
      spriteFactory = factories.spriteFactory;
      effectHandler = factories.effectHandler;
    } catch (e) {
      console.warn("[buildSceneFromLogic] Failed to create Pixi factories:", e);
    }
  } else {
    console.warn("[buildSceneFromLogic] Non-Pixi application detected");
  }

  // Use LayerCreator to handle all the complex logic
  const layerCreatorManager = createLayerCreatorManager(spriteFactory);
  return await layerCreatorManager.init(app, cfg, effectHandler);
}

/**
 * Create Pixi engine implementation that uses LayerCreator internally
 */
export function createPixiEngine(): PixiEngine {
  let _app: Application | null = null;
  let _root: HTMLElement | null = null;
  let _layerManager: LayerCreatorManager | null = null;
  let _result: BuildResult | null = null;

  const engine = {
    async init(
      root: HTMLElement,
      cfg: LogicConfig,
      opts?: PixiEngineOptions,
    ): Promise<EngineHandle> {
      _root = root;

      // Create Pixi Application using unified creation function
      const stage2048Options: Stage2048Options = {
        backgroundAlpha: opts?.backgroundAlpha ?? 0,
        antialias: opts?.antialias ?? true,
        dprCap: opts?.dprCap ?? 2,
      };
      
      try {
        _app = createPixiApplication(stage2048Options, Application);
        
        if (!_app) {
          throw new Error("Failed to create Pixi application");
        }

        // Mount canvas to DOM
        root.appendChild(_app.view as HTMLCanvasElement);

        // Use LayerCreator to build the scene
        const factories = createPixiFactories();
        _layerManager = createLayerCreatorManager(factories.spriteFactory);
        _result = await _layerManager.init(_app, cfg, factories.effectHandler);
      } catch (error) {
        console.error("[createPixiEngine] Failed to initialize:", error);
        throw error;
      }

      // Add the container to the stage
      _app.stage.addChild(_result.container as Container);

      // Return handle for external cleanup
      return {
        dispose() {
          engine.dispose();
        },
      };
    },

    tick(elapsed: number): void {
      _layerManager?.tick(elapsed);
    },

    recompute(): void {
      _layerManager?.recompute();
    },

    dispose(): void {
      try {
        _layerManager?.dispose();
      } catch {}

      try {
        if (_root && _app?.view && _root.contains(_app.view as HTMLCanvasElement)) {
          _root.removeChild(_app.view as HTMLCanvasElement);
        }
      } catch {}

      try {
        _app?.destroy(true, { children: true, texture: true, baseTexture: true });
      } catch {}

      _app = null;
      _root = null;
      _layerManager = null;
      _result = null;
    },

    getApplication(): Application | null {
      return _app;
    },

    getContainer(): GenericContainer | null {
      return _result?.container ?? null;
    },

    getLayers(): BuiltLayer[] {
      return _result?.layers ? [..._result.layers] : [];
    },

    hasAnimations(): boolean {
      return _layerManager?.hasAnimations() ?? false;
    },
  };

  return engine;
}

// ===================================================================
// EXPORTS
// ===================================================================

// Re-export types for external use
export type { EffectHandler, GlowSpec, BloomSpec, AdvancedEffectSpec };

// Export utility functions
export { logicZIndexFor, logicApplyBasicTransform };