import type { LogicConfig } from "./sceneTypes";
import { createPixiEngine, type PixiEngineOptions } from "./EnginePixi";
import { createDomEngine, type DomEngineOptions } from "./EngineDom";
import type { LogicEngine, EngineHandle, EngineOptions } from "./LogicTypes";

// Renderer type selection
export type RendererType = "pixi" | "dom";

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
 * LogicEngineAdapter provides a clean abstraction layer for renderer selection.
 * It can work with both EnginePixi and EngineDom backends while maintaining
 * a consistent interface for consumers.
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
      } else if (renderer === "dom") {
        this.engine = createDomEngine();
        const domOpts: DomEngineOptions = {
          ...opts,
        };
        this.engineHandle = await this.engine.init(root, cfg, domOpts);
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
      if (this.renderer === "dom" && this.engine) {
        const domEngine = this.engine as any;
        return domEngine.hasAnimations?.() ?? false;
      }
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

// Types are exported above where they are defined