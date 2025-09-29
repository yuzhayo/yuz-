/**
 * LayerCreator.ts - Unified Layer Processing & Stage System
 * 
 * ⚠️  AI AGENT CRITICAL INSTRUCTIONS:
 * 
 * This file contains MERGED functionality from:
 * - Stage2048.ts (Stage system, transform management, LogicStage component)
 * - EnginePixi.ts (Pixi-specific factories and engine)
 * - LayerContracts.ts (All type definitions and interfaces)
 * - LayerCreator.ts (Core layer processing system)
 * 
 * The file is organized into ISOLATED BLOCKS. Each block is marked as:
 * 🔴 CRITICAL - DO NOT DELETE (breaks core functionality)
 * 🟡 OPTIONAL - Safe to delete (removes animations/effects but basic display works)
 * 🟢 UTILITY - Safe to delete (math helpers only, no visual impact)
 * 
 * Deleting any 🔴 CRITICAL block will break the application!
 * 🟡 OPTIONAL blocks can be safely removed to reduce features.
 * 🟢 UTILITY blocks provide math helpers and can be deleted.
 */

import React from "react";
import type {
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import { Application, Assets, Container, Sprite, Renderer } from "pixi.js";
import { createLayerSpinManager } from "./LayerSpin";
import type { LayerSpinManager } from "./LayerSpin";
import { createLayerClockManager } from "./LayerClock";
import type { LayerClockManager } from "./LayerClock";
import { createLayerOrbitManager } from "./LayerOrbit";
import type { LayerOrbitManager } from "./LayerOrbit";
import { createLayerEffectManager } from "./LayerEffect";
import { toRad } from "./math";
import type { LayerEffectManager, EffectHandler, GlowSpec, BloomSpec, AdvancedEffectSpec } from "./LayerEffect";

// Re-export imported types for backward compatibility
export type { EffectHandler, GlowSpec, BloomSpec, AdvancedEffectSpec };

// ===================================================================
// 🔴 BLOCK 1: ALL TYPE CONTRACTS & INTERFACES
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Core data contracts and type definitions for the entire system
// ===================================================================

// === CORE DATA CONTRACTS ===
export type ImageRegistry = Record<string, string>;
export type ImageRef = { kind: "urlId"; id: string } | { kind: "url"; url: string };
export type RendererMode = "pixi";

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

// Layer configuration schema
export type LayerConfig = {
  id: string;
  imageRef: ImageRef;
  position: { xPct: number; yPct: number };
  scale?: { pct?: number };
  angleDeg?: number;
  // Spin properties
  spinRPM?: number | null;
  spinDir?: "cw" | "ccw";
  // Orbit properties
  orbitRPM?: number | null;
  orbitDir?: "cw" | "ccw";
  orbitCenter?: { xPct: number; yPct: number };
  orbitPhaseDeg?: number | null;
  orbitOrientPolicy?: "none" | "auto" | "override";
  orbitOrientDeg?: number | null;
  // Clock and effects
  clock?: any;
  effects?: any;
};

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

export type LogicConfig = {
  layersID: string[];
  imageRegistry: ImageRegistry;
  layers: LayerConfig[];
};

// === MODULE CAPABILITY INTERFACES ===

// Base interface all optional modules must implement
export interface LayerModule {
  init(...args: any[]): Promise<void> | void;
  tick?(elapsed: number): void;
  recompute?(): void;
  dispose?(): void;
  isRequired: boolean; // true = critical, false = optional
}

// Sprite factory interface for renderer abstraction
export interface SpriteFactory {
  createSprite(url: string): Promise<GenericSprite>;
  createContainer(): GenericContainer;
  loadAssets(urls: string[]): Promise<void>;
}

// Plugin registry for modular capabilities
export interface PluginRegistry {
  [key: string]: LayerModule;
}

// === STAGE2048 TYPES ===

export interface StageTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  containerWidth: number;
  containerHeight: number;
}

export interface StageCoordinates {
  stageX: number;
  stageY: number;
}

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

// === PIXI ENGINE TYPES ===

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

// ===================================================================
// 🔴 BLOCK 2: STAGE2048 CONSTANTS & CSS
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Fixed stage dimensions and CSS styles for responsive scaling
// ===================================================================

/** Fixed stage dimensions - 2048×2048 design canvas */
export const STAGE_WIDTH = 2048;
export const STAGE_HEIGHT = 2048;

/** CSS styles for the stage system */
export const STAGE_CSS = `
/**
 * Stage 1:1 Cover CSS
 * Ensures 2048×2048 design world displays consistently across all devices
 * with cover behavior (fills viewport, maintains aspect ratio)
 */

/* Container for the stage - centered and scaled */
.stage-cover-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transform-origin: center center;
  overflow: hidden;
  
  /* Will be set dynamically by JS */
  width: 2048px;
  height: 2048px;
}

/* The actual canvas element */
.stage-cover-canvas {
  display: block;
  transform-origin: 0 0;
  
  /* Fixed design dimensions */
  width: 2048px !important;
  height: 2048px !important;
  
  /* Prevent any browser-imposed sizing */
  max-width: none !important;
  max-height: none !important;
  min-width: 2048px !important;
  min-height: 2048px !important;
  
  /* GPU acceleration */
  will-change: transform;
  
  /* Disable user interaction on the canvas itself 
     (gestures will be handled by overlay) */
  pointer-events: none;
}

/* Overlay for gesture handling - covers the scaled area */
.stage-cover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  z-index: 1;
  
  /* Invisible but interactive */
  background: transparent;
}

/* Root container should fill viewport */
.stage-cover-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

/* Debug overlay (optional - can be toggled for development) */
.stage-cover-debug {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-family: monospace;
  font-size: 12px;
  border-radius: 4px;
  z-index: 9999;
  pointer-events: none;
}

/* Animation for smooth transitions */
.stage-cover-container,
.stage-cover-canvas {
  transition: transform 0.1s ease-out;
}

/* Mobile-specific optimizations */
@media (max-width: 768px) {
  .stage-cover-container,
  .stage-cover-canvas {
    /* Faster transitions on mobile */
    transition: transform 0.05s ease-out;
  }
}

/* Prevent text selection in the stage area */
.stage-cover-root {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  
  /* Prevent touch callouts */
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
`.trim();

// ===================================================================
// 🟢 BLOCK 3: UTILITY FUNCTIONS & EXPORTS (MERGED: Block 3 + Block 16)
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete if not needed
// Math helpers, stage transformations, and convenience exports
// ===================================================================

export function calculateStageTransform(
  viewportWidth: number,
  viewportHeight: number,
): StageTransform {
  // Cover behavior: scale to fill viewport, crop what doesn't fit
  const scaleX = viewportWidth / STAGE_WIDTH;
  const scaleY = viewportHeight / STAGE_HEIGHT;
  const scale = Math.max(scaleX, scaleY); // Use larger scale for cover

  const scaledWidth = STAGE_WIDTH * scale;
  const scaledHeight = STAGE_HEIGHT * scale;

  // Center the scaled stage
  const offsetX = (viewportWidth - scaledWidth) / 2;
  const offsetY = (viewportHeight - scaledHeight) / 2;

  return {
    scale,
    offsetX,
    offsetY,
    containerWidth: scaledWidth,
    containerHeight: scaledHeight,
  };
}

/**
 * Transform viewport coordinates to stage coordinates
 * Essential for making gestures work with scaled canvas
 */
export function transformCoordinatesToStage(
  clientX: number,
  clientY: number,
  transform: StageTransform,
): StageCoordinates {
  // Convert from viewport coordinates to stage coordinates
  const stageX = (clientX - transform.offsetX) / transform.scale;
  const stageY = (clientY - transform.offsetY) / transform.scale;

  return { stageX, stageY };
}

/**
 * Check if coordinates are within the stage bounds
 */
export function isWithinStage(stageX: number, stageY: number): boolean {
  return stageX >= 0 && stageX <= STAGE_WIDTH && stageY >= 0 && stageY <= STAGE_HEIGHT;
}

/**
 * Inject CSS styles into the document head
 * Only injects once, safe to call multiple times
 */
export function ensureStageStyles(): void {
  const styleId = "stage2048-styles";

  // Check if styles are already injected
  if (document.getElementById(styleId)) {
    return;
  }

  // Create and inject style element
  const styleElement = document.createElement("style");
  styleElement.id = styleId;
  styleElement.textContent = STAGE_CSS;
  document.head.appendChild(styleElement);
}

// === CONSOLIDATED EXPORTS (formerly Block 16) ===
// Export utilities for external access
export {
  logicZIndexFor,
  logicApplyBasicTransform,
};
export { toRad, toDeg, clamp, clamp01, clampRpm60, normDeg } from "./math";

// Export default for LogicStage
export default LogicStage;

// ===================================================================
// 🔴 BLOCK 4: TRANSFORM & CONFIGURATION (MERGED: Block 4 + Block 5 + Block 6)
// ⚠️  AI AGENT: CRITICAL BLOCK - Core functions are critical, transform management is optional
// Handles layer positioning, config processing, and DOM coordinate transformations
// ===================================================================

// === CORE LAYER TRANSFORM FUNCTIONS (formerly Block 4) ===
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

// === CONFIG PROCESSING (formerly Block 5) ===
function getUrlForImageRef(cfg: LogicConfig, ref: LayerConfig["imageRef"]): string | null {
  if (ref.kind === "url") return ref.url;
  const url = cfg.imageRegistry[ref.id];
  return url ?? null;
}

// === STAGE2048 TRANSFORM MANAGEMENT (formerly Block 6) ===

/**
 * Stage transform manager class
 * Handles DOM manipulation and coordinate transformation
 */
export class StageTransformManager {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private overlay: HTMLElement | null = null;
  private transform: StageTransform | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private debugElement: HTMLElement | null = null;

  constructor(private debug = false) {
    // Initialize resize observer
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === document.body || entry.target === document.documentElement) {
          this.updateTransform();
        }
      }
    });
  }

  /**
   * Initialize the stage transform system
   */
  initialize(container: HTMLElement, canvas: HTMLCanvasElement, overlay?: HTMLElement) {
    this.container = container;
    this.canvas = canvas;
    this.overlay = overlay || null;

    // Apply CSS classes
    container.classList.add("stage-cover-container");
    canvas.classList.add("stage-cover-canvas");
    if (overlay) {
      overlay.classList.add("stage-cover-overlay");
    }

    // Start observing resize events
    this.resizeObserver?.observe(document.body);

    // Setup debug if enabled
    if (this.debug) {
      this.setupDebug();
    }

    // Initial transform
    this.updateTransform();

    return this;
  }

  /**
   * Update transform based on current viewport size
   */
  updateTransform() {
    if (!this.container || !this.canvas) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    this.transform = calculateStageTransform(viewportWidth, viewportHeight);

    // Apply CSS transforms
    this.canvas.style.transform = `scale(${this.transform.scale})`;
    this.container.style.width = `${this.transform.containerWidth}px`;
    this.container.style.height = `${this.transform.containerHeight}px`;

    // Update debug info
    if (this.debug && this.debugElement) {
      this.updateDebugInfo();
    }
  }

  /**
   * Transform event coordinates to stage coordinates
   */
  transformEventCoordinates(
    event: PointerEvent | MouseEvent | TouchEvent,
  ): StageCoordinates | null {
    if (!this.transform) return null;

    let clientX: number, clientY: number;

    if ("touches" in event && event.touches.length > 0) {
      // Touch event
      const firstTouch = event.touches.item(0);
      if (!firstTouch) return null;
      clientX = firstTouch.clientX;
      clientY = firstTouch.clientY;
    } else if ("clientX" in event) {
      // Mouse or pointer event
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      return null;
    }

    return transformCoordinatesToStage(clientX, clientY, this.transform);
  }

  /**
   * Get current transform data
   */
  getTransform(): StageTransform | null {
    return this.transform;
  }

  /**
   * Setup debug overlay
   */
  private setupDebug() {
    this.debugElement = document.createElement("div");
    this.debugElement.classList.add("stage-cover-debug");
    document.body.appendChild(this.debugElement);
    this.updateDebugInfo();
  }

  /**
   * Update debug information
   */
  private updateDebugInfo() {
    if (!this.debugElement || !this.transform) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const aspectRatio = (vw / vh).toFixed(2);

    this.debugElement.innerHTML = `
      Stage: ${STAGE_WIDTH}×${STAGE_HEIGHT}<br>
      Viewport: ${vw}×${vh} (${aspectRatio}:1)<br>
      Scale: ${this.transform.scale.toFixed(3)}<br>
      Container: ${Math.round(this.transform.containerWidth)}×${Math.round(this.transform.containerHeight)}<br>
      Offset: ${Math.round(this.transform.offsetX)}, ${Math.round(this.transform.offsetY)}
    `.trim();
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.resizeObserver?.disconnect();
    if (this.debugElement) {
      document.body.removeChild(this.debugElement);
    }
    this.container = null;
    this.canvas = null;
    this.overlay = null;
    this.transform = null;
    this.debugElement = null;
  }
}

// ===================================================================
// 🟡 BLOCK 7: PIXI ENGINE FACTORIES
// ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes Pixi-specific features)
// Pixi-specific implementations for sprite creation and effects
// ===================================================================

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

// === CONSOLIDATED PIXI FACTORIES (merged separate factory functions) ===
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
// 🔴 BLOCK 8: CORE MANAGER & ANIMATION STATE (MERGED: Block 8 + Block 10)
// ⚠️  AI AGENT: CRITICAL BLOCK - Core implementation with optional animations
// Main implementation that creates and manages layers with animation support
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
// 🔴 BLOCK 9: CORE MANAGER INTERFACE
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

      // Initialize animation managers (inlined from former createAnimationManagers)
      const spinManager = createLayerSpinManager();
      spinManager.init(app, built);

      const clockManager = createLayerClockManager();
      clockManager.init(app, built);

      // Build RPM map for orbit system compatibility
      const spinRpmBySprite = new Map<GenericSprite, number>();
      for (const layer of built) {
        spinRpmBySprite.set(layer.sprite, spinManager.getSpinRpm(layer.sprite));
      }

      const orbitManager = createLayerOrbitManager();
      orbitManager.init(app, built, spinRpmBySprite);

      // Effects (unified system)
      const effectManager = createLayerEffectManager(effectHandler);
      effectManager.init(app, built);

      _managersState = {
        spinManager,
        clockManager,
        orbitManager,
        effectManager,
        elapsed: 0,
      };

      // ===================================================================
      // 🟡 BLOCK 12: LIFECYCLE HOOKS (RESIZE/TICKER)
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
// 🟡 BLOCK 13: STAGE2048 FACTORY FUNCTIONS
// ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes stage creation)
// Factory functions for creating complete Stage2048 systems
// ===================================================================

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

// === REACT INTEGRATION ===

/**
 * Create a coordinate transformer hook for React components
 */
export function createCoordinateTransformer(manager: StageTransformManager) {
  const transformNativeEvent = (event: PointerEvent | MouseEvent | TouchEvent) => {
    return manager.transformEventCoordinates(event);
  };

  return {
    /**
     * Transform pointer event coordinates to stage coordinates
     */
    transformPointerEvent: (event: ReactPointerEvent<HTMLElement>): StageCoordinates | null => {
      return transformNativeEvent(event.nativeEvent);
    },

    /**
     * Transform mouse event coordinates to stage coordinates
     */
    transformMouseEvent: (event: ReactMouseEvent<HTMLElement>): StageCoordinates | null => {
      return transformNativeEvent(event.nativeEvent);
    },

    /**
     * Transform touch event coordinates to stage coordinates
     */
    transformTouchEvent: (event: ReactTouchEvent<HTMLElement>): StageCoordinates | null => {
      return transformNativeEvent(event.nativeEvent);
    },

    /**
     * Get current stage transform data
     */
    getTransform: (): StageTransform | null => manager.getTransform(),

    /**
     * Check if stage coordinates are within bounds
     */
    isWithinStage: (stageX: number, stageY: number): boolean => {
      return isWithinStage(stageX, stageY);
    },
  };
}

/**
 * Hook for using coordinate transformation in gesture components
 */
export function useStageCoordinates(transformManager: StageTransformManager) {
  return createCoordinateTransformer(transformManager);
}

// ===================================================================
// 🟡 BLOCK 14: LOGICSTAGE REACT COMPONENT
// ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes React component)
// React component for integrating with the layer system
// ===================================================================

export type LogicStageProps = {
  className?: string;
  buildSceneFromLogic?: (app: any, config: any) => Promise<{ container: any }>;
  logicConfig?: any;
};

export function LogicStage(props: LogicStageProps = {}) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let stage: any = null;
    let cleanupScene: (() => void) | undefined;
    (async () => {
      const el = ref.current;
      if (!el) return;

      try {
        // Create stage with 2048×2048 dimensions using the new module
        stage = await createStage2048(el, {
          backgroundAlpha: 0,
          antialias: true,
          debug: false, // Set to true for development debugging
          autoInjectCSS: true,
        });

        // Build scene using provided builder function and config
        if (props.buildSceneFromLogic && props.logicConfig) {
          const scene = await props.buildSceneFromLogic(stage.app, props.logicConfig);
          stage.app.stage.addChild(scene.container);
          console.log("[LogicStage] Scene built and added successfully");

          cleanupScene = () => {
            try {
              (scene.container as any)._cleanup?.();
            } catch {}
            try {
              // Only call destroy if it exists (Pixi containers have destroy, but generic containers may not)
              if (typeof (scene.container as any).destroy === 'function') {
                (scene.container as any).destroy({ children: true });
              }
            } catch {}
          };
        } else {
          console.log("[LogicStage] No scene builder provided, stage created without scene");
          cleanupScene = () => {
            console.log("[LogicStage] Scene cleanup called");
          };
        }
      } catch (e) {
        console.error("[LogicStage] Failed to build scene from logic config", e);
      }
    })();

    return () => {
      try {
        cleanupScene?.();
      } catch {}
      try {
        stage?.dispose();
      } catch {}
    };
  }, []);

  return React.createElement("div", { 
    ref, 
    className: props?.className 
  });
}

// ===================================================================
// 🟡 BLOCK 15: PIXI ENGINE IMPLEMENTATION
// ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes engine wrapper)
// Advanced Pixi engine implementation for direct control
// ===================================================================

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
      const factories = createPixiFactories();
      _layerManager = createLayerCreatorManager(factories.spriteFactory);
      _result = await _layerManager.init(_app, cfg, factories.effectHandler);

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


