import { Application, Assets, Container, Sprite } from "pixi.js";
import type {
  LogicConfig,
  GenericSprite,
  GenericContainer,
  GenericApplication,
  BuiltLayer,
  BuildResult,
  SpriteFactory,
  EffectHandler,
  LayerCreatorManager,
} from "./LayerCreator";
import { createLayerCreatorManager } from "./LayerCreator";
import type { GlowSpec, BloomSpec, AdvancedEffectSpec } from "./LayerEffect";

// === PIXI APPLICATION DETECTION ===
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

// === PIXI-SPECIFIC EFFECT HANDLER ===
export function createPixiEffectHandler(): EffectHandler {
  return {
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
}

// === PIXI-SPECIFIC SPRITE FACTORY ===
export function createPixiSpriteFactory(): SpriteFactory {
  return {
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
}

// === SIMPLIFIED BUILD SCENE FUNCTION ===
// This is the main function used by the Stage2048 component
export async function buildSceneFromLogic(
  app: GenericApplication,
  cfg: LogicConfig,
): Promise<BuildResult> {
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

  // Use LayerCreator to handle all the complex logic
  const layerCreatorManager = createLayerCreatorManager(spriteFactory);
  return await layerCreatorManager.init(app, cfg, effectHandler);
}

// === ENGINE ADAPTER FOR ADVANCED USAGE ===
// This provides a higher-level interface for direct engine control
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

// Create Pixi engine implementation that uses LayerCreator internally
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

      // Create Pixi Application with options
      const dpr = Math.min(opts?.dprCap ?? 2, window.devicePixelRatio || 1);
      _app = new Application({
        resizeTo: opts?.resizeTo ?? window,
        backgroundAlpha: opts?.backgroundAlpha ?? 0,
        antialias: opts?.antialias ?? true,
        autoDensity: true,
        resolution: dpr,
      });

      // Mount canvas to DOM
      root.appendChild(_app.view as HTMLCanvasElement);

      // Use LayerCreator to build the scene
      const spriteFactory = createPixiSpriteFactory();
      const effectHandler = createPixiEffectHandler();
      _layerManager = createLayerCreatorManager(spriteFactory);
      _result = await _layerManager.init(_app, cfg, effectHandler);

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

// === CONVENIENCE EXPORTS ===
export function createEngine(): PixiEngine {
  return createPixiEngine();
}

// Re-export important types from LayerCreator for convenience
export type {
  BuiltLayer,
  BuildResult,
  LogicConfig,
  GenericSprite,
  GenericContainer,
  GenericApplication,
} from "./LayerCreator";
