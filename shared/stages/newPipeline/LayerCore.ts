/**
 * LayerCore.ts - Core Layer Processing Types & Utilities
 *
 * Self-contained implementation with:
 * - Stage Math Helpers (constants, transform functions, coordinate conversion)
 * - StageTransformManager Class (centralized coordinate/resize logic)
 * - Math Helpers (mathematical utilities for self-contained usage)
 * - Animation Manager Interfaces (contracts for the animation system)
 */

// ===================================================================
// STAGE CONSTANTS & CSS
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
// CORE TYPE DEFINITIONS
// Stage transformation and coordinate types
// ===================================================================

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

// ===================================================================
// MATH HELPERS
// Mathematical utilities for self-contained usage
// ===================================================================

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function normDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

export function clampRpm60(v: unknown): number {
  const n = typeof v === "number" ? v : v == null ? 0 : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(60, Math.max(0, n));
}

// ===================================================================
// STAGE MATH HELPERS
// Transform functions and coordinate conversion utilities
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

// ===================================================================
// STAGE TRANSFORM MANAGER CLASS
// Centralized coordinate/resize logic management
// ===================================================================

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
   * Get the overlay element
   */
  getOverlay(): HTMLElement | null {
    return this.overlay;
  }

  /**
   * Setup debug overlay
   */
  private setupDebug() {
    if (!this.container || this.debugElement) return;

    this.debugElement = document.createElement("div");
    this.debugElement.classList.add("stage-cover-debug");
    this.container.appendChild(this.debugElement);
    this.updateDebugInfo();
  }

  /**
   * Update debug information
   */
  private updateDebugInfo() {
    if (!this.debugElement || !this.transform) return;

    const { scale, offsetX, offsetY, containerWidth, containerHeight } = this.transform;
    this.debugElement.innerHTML = [
      `Scale: ${scale.toFixed(3)}`,
      `Offset: ${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}`,
      `Container: ${containerWidth.toFixed(1)}×${containerHeight.toFixed(1)}`,
      `Viewport: ${window.innerWidth}×${window.innerHeight}`,
    ].join("<br>");
  }

  /**
   * Dispose and cleanup resources
   */
  dispose() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.debugElement && this.debugElement.parentNode) {
      this.debugElement.parentNode.removeChild(this.debugElement);
    }
    this.debugElement = null;

    this.container = null;
    this.canvas = null;
    this.overlay = null;
    this.transform = null;
  }
}

// ===================================================================
// ANIMATION MANAGER INTERFACES
// Manager contracts for the animation system
// ===================================================================

// === GENERIC TYPES FOR ENGINE ABSTRACTION ===

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

export interface BuiltLayer {
  id: string;
  sprite: GenericSprite;
  cfg: any; // LayerConfig type - kept as any to avoid circular dependencies
}

// === LAYER SPIN TYPES & MANAGER ===

export type BasicSpinItem = {
  sprite: GenericSprite;
  baseRad: number;
  radPerSec: number;
  dir: 1 | -1;
  mode: "basic";
};

export type SpinItem = BasicSpinItem;

export interface LayerSpinManager {
  init(app: GenericApplication, built: BuiltLayer[]): void;
  tick(elapsed: number): void;
  recompute(): void;
  dispose(): void;
  getSpinRpm(sprite: GenericSprite): number;
  getItems(): SpinItem[];
}

// === LAYER CLOCK TYPES & MANAGER ===

export type ClockHand = "second" | "minute" | "hour";

export type Vec2 = { x: number; y: number };

export type TimeSource = {
  mode: "device" | "utc" | "server";
  tzOffsetMinutes?: number | null;
};

export type ClockGeometry = {
  baseLocal: Vec2;
  tipLocal: Vec2;
  baseTipAngle: number;
  baseTipLength: number;
  sourceWidth: number;
  sourceHeight: number;
};

export type SpinSettings = {
  hand: ClockHand | null;
  radius: { value: number | null; pct: number | null };
  staticAngle: number;
  phase: number;
};

export type OrbitSettings = {
  hand: ClockHand | null;
  centerPct: { xPct: number; yPct: number };
  centerPx: Vec2;
  radius: number;
  phase: number;
};

export type ClockItem = {
  sprite: GenericSprite;
  cfg: any; // LayerConfig
  clock: any; // ClockConfig
  geometry: ClockGeometry;
  positionFallback: { xPct: number; yPct: number };
  centerPct: { xPct: number; yPct: number };
  centerPx: Vec2;
  spin: SpinSettings;
  orbit: OrbitSettings | null;
  time: { source: TimeSource; smooth: boolean; format: 12 | 24 };
};

export interface LayerClockManager {
  init(app: GenericApplication, built: BuiltLayer[]): void;
  tick(): void;
  recompute(): void;
  dispose(): void;
  getItems(): ClockItem[];
}

// === LAYER ORBIT TYPES & MANAGER ===

export type OrbitItem = {
  sprite: GenericSprite;
  cfg: any; // LayerConfig
  dir: 1 | -1;
  radPerSec: number;
  centerPct: { x: number; y: number };
  centerPx: { cx: number; cy: number };
  radius: number;
  basePhase: number;
  orientPolicy: "none" | "auto" | "override";
  orientDegRad: number;
  spinRpm: number;
};

export interface LayerOrbitManager {
  init(
    app: GenericApplication,
    built: BuiltLayer[],
    spinRpmBySprite?: Map<GenericSprite, number>,
  ): void;
  tick(elapsed: number): void;
  recompute(elapsed: number): void;
  dispose(): void;
  getItems(): OrbitItem[];
}

// === LAYER EFFECT TYPES & MANAGER ===

// Effect specifications
export type FadeSpec = {
  type: "fade";
  from: number;
  to: number;
  durationMs: number;
  loop: boolean;
  easing: "linear" | "sineInOut";
};

export type PulseSpec = {
  type: "pulse";
  property: "scale" | "alpha";
  amp: number;
  periodMs: number;
  phaseDeg: number;
};

export type GlowSpec = {
  type: "glow";
  color: number;
  alpha: number;
  scale: number;
  pulseMs?: number;
};

export type BloomSpec = {
  type: "bloom";
  strength: number;
};

export type DistortSpec = {
  type: "distort";
  ampPx: number;
  speed: number;
};

export type ShockwaveSpec = {
  type: "shockwave";
  periodMs: number;
  maxScale: number;
  fade: boolean;
};

export type BasicEffectSpec = FadeSpec | PulseSpec;
export type AdvancedEffectSpec = GlowSpec | BloomSpec | DistortSpec | ShockwaveSpec;

export type LayerEffectItem = {
  spriteIdx: number;
  basicSpecs: BasicEffectSpec[];
  advancedSpecs: AdvancedEffectSpec[];
  baseAlpha: number;
  baseScale: number;
  prevTiltRad?: number;
  // Advanced effect state
  auras: Array<{
    sprite: GenericSprite;
    baseScale: number;
    strength: number;
    pulseMs?: number;
    color?: number;
    alpha: number;
  }>;
  distort?: {
    baseX: number;
    baseY: number;
    ampPx: number;
    speed: number;
  };
  shock?: {
    baseScale: number;
    periodMs: number;
    maxScale: number;
    fade: boolean;
  };
};

export interface EffectHandler {
  createAuraSprite(originalSprite: GenericSprite, spec: GlowSpec | BloomSpec): GenericSprite | null;
  applyAdvancedEffect(sprite: GenericSprite, spec: AdvancedEffectSpec, elapsed: number): void;
  disposeAuraSprite(sprite: GenericSprite): void;
}

export interface LayerEffectManager {
  init(app: GenericApplication, built: BuiltLayer[]): void;
  tick(elapsed: number, builtRef: BuiltLayer[]): void;
  recompute(): void;
  dispose(): void;
  getItems(): LayerEffectItem[];
  hasEffects(): boolean;
}

// ===================================================================
// LAYER SPIN MANAGER IMPLEMENTATION
// Self-contained RPM-based spinning system
// ===================================================================

// Config normalization functions
function normalizeSpinDirection(dir: string | undefined): 1 | -1 {
  return dir === "ccw" ? -1 : (1 as 1 | -1);
}

function calculateRadPerSec(rpm: number): number {
  return (rpm * Math.PI) / 30;
}

// Create basic spin manager
export function createLayerSpinManager(): LayerSpinManager {
  const items: SpinItem[] = [];
  const rpmBySprite = new Map<GenericSprite, number>();
  let _app: GenericApplication | null = null;

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
// LAYER CLOCK MANAGER IMPLEMENTATION  
// Self-contained clock hand rotation system
// ===================================================================

// Clock utility functions
function getSpriteDimensions(sp: GenericSprite): { width: number; height: number } | null {
  const spriteAny = sp as any;
  let width: number;
  let height: number;

  // Pixi.js sprite with texture
  if (spriteAny.texture) {
    const tex = spriteAny.texture;
    width = tex.orig?.width ?? tex.width ?? spriteAny.width;
    height = tex.orig?.height ?? tex.height ?? spriteAny.height;
  }
  // Fallback to generic width/height
  else {
    width = spriteAny.width || 0;
    height = spriteAny.height || 0;
  }

  if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function pointOnRect(width: number, height: number, angleRad: number): Vec2 {
  if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return { x: 0, y: 0 };
  const hw = width / 2;
  const hh = height / 2;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  const eps = 1e-6;
  const candidates: Array<{ t: number; x: number; y: number }> = [];

  if (Math.abs(dx) > eps) {
    const sx = dx > 0 ? hw : -hw;
    const tx = sx / dx;
    const y = tx * dy;
    if (tx >= 0 && Math.abs(y) <= hh + 1e-4) candidates.push({ t: tx, x: dx * tx, y });
  }
  if (Math.abs(dy) > eps) {
    const sy = dy > 0 ? hh : -hh;
    const ty = sy / dy;
    const x = ty * dx;
    if (ty >= 0 && Math.abs(x) <= hw + 1e-4) candidates.push({ t: ty, x, y: dy * ty });
  }

  if (candidates.length === 0) return { x: 0, y: 0 };
  candidates.sort((a, b) => a.t - b.t);
  const best = candidates[0];
  if (!best) return { x: 0, y: 0 };
  return { x: best.x, y: best.y };
}

function resolveTimeSource(clock: any): TimeSource {
  const tz = clock.timezone ?? "device";
  const offset = clock.source?.tzOffsetMinutes ?? null;
  if (tz === "utc") return { mode: "utc", tzOffsetMinutes: offset };
  if (tz === "server") return { mode: "server", tzOffsetMinutes: offset };
  return { mode: "device", tzOffsetMinutes: offset };
}

function getTimeParts(src: TimeSource) {
  const now = Date.now();
  if (src.mode === "device" && src.tzOffsetMinutes == null) {
    const d = new Date(now);
    return { H: d.getHours(), M: d.getMinutes(), S: d.getSeconds(), ms: d.getMilliseconds() };
  }
  const shift = (src.tzOffsetMinutes ?? 0) * 60000;
  const d = new Date(now + shift);
  return {
    H: d.getUTCHours(),
    M: d.getUTCMinutes(),
    S: d.getUTCSeconds(),
    ms: d.getUTCMilliseconds(),
  };
}

function timeAngleRad(
  parts: { H: number; M: number; S: number; ms: number },
  hand: ClockHand,
  format: 12 | 24,
  smooth: boolean,
): number {
  const { H, M, S, ms } = parts;
  if (hand === "second") {
    const s = S + (smooth ? ms / 1000 : 0);
    return 2 * Math.PI * (s / 60);
  }
  if (hand === "minute") {
    const m = M + (smooth ? S / 60 : 0);
    return 2 * Math.PI * (m / 60);
  }
  const h =
    format === 24
      ? (H + (smooth ? M / 60 + S / 3600 : 0)) / 24
      : ((H % 12) + (smooth ? M / 60 + S / 3600 : 0)) / 12;
  return 2 * Math.PI * h;
}

function computeClockGeometry(
  sprite: GenericSprite,
  clock: any,
  layerId: string,
): ClockGeometry | null {
  const dims = getSpriteDimensions(sprite);
  if (!dims) {
    console.warn(`[Clock] ${layerId}: missing texture dimensions`);
    return null;
  }

  const baseAngle = toRad(clock.base?.angleDeg ?? 0);
  const tipAngle = toRad(clock.tip?.angleDeg ?? 0);
  const baseLocal = pointOnRect(dims.width, dims.height, baseAngle);
  const tipLocal = pointOnRect(dims.width, dims.height, tipAngle);
  const baseTipLength = Math.hypot(tipLocal.x - baseLocal.x, tipLocal.y - baseLocal.y);

  if (!isFinite(baseTipLength) || baseTipLength <= 1e-3) {
    console.warn(`[Clock] ${layerId}: invalid base/tip configuration`);
    return null;
  }

  return { 
    baseLocal, 
    tipLocal, 
    baseTipAngle: Math.atan2(tipLocal.y - baseLocal.y, tipLocal.x - baseLocal.x),
    baseTipLength,
    sourceWidth: dims.width,
    sourceHeight: dims.height
  };
}

// Create clock manager
export function createLayerClockManager(): LayerClockManager {
  const items: ClockItem[] = [];
  let _app: GenericApplication | null = null;

  return {
    init(app: GenericApplication, built: BuiltLayer[]) {
      _app = app;
      items.length = 0;

      for (const b of built) {
        const clock = b.cfg.clock;
        if (!clock?.enabled) continue;

        const geometry = computeClockGeometry(b.sprite, clock, b.id);
        if (!geometry) continue;

        const item: ClockItem = {
          sprite: b.sprite,
          cfg: b.cfg,
          clock,
          geometry,
          positionFallback: { xPct: b.cfg.position.xPct ?? 0, yPct: b.cfg.position.yPct ?? 0 },
          centerPct: { xPct: 50, yPct: 50 },
          centerPx: { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 },
          spin: {
            hand: clock.hand ?? "hour",
            radius: { value: null, pct: null },
            staticAngle: b.sprite.rotation,
            phase: 0
          },
          orbit: null,
          time: {
            source: resolveTimeSource(clock),
            smooth: clock.smooth ?? true,
            format: clock.format ?? 12
          }
        };

        items.push(item);
      }
    },

    tick() {
      for (const item of items) {
        const timeParts = getTimeParts(item.time.source);
        const hand = item.spin.hand ?? "hour";
        const format = item.time.format;
        const smooth = item.time.smooth;

        const angle = timeAngleRad(timeParts, hand, format, smooth);
        item.sprite.rotation = item.spin.staticAngle + angle;
      }
    },

    recompute() {
      // Clock doesn't need recomputation for resize events
    },

    dispose() {
      items.length = 0;
      _app = null;
    },

    getItems(): ClockItem[] {
      return [...items];
    },
  };
}

// ===================================================================
// LAYER ORBIT MANAGER IMPLEMENTATION
// Self-contained orbital motion system
// ===================================================================

// Orbit utility functions
function projectToRectBorder(
  cx: number,
  cy: number,
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number } {
  if (x >= 0 && x <= w && y >= 0 && y <= h) return { x, y };
  const dx = x - cx;
  const dy = y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const eps = 1e-6;
  const cand: { t: number; x: number; y: number }[] = [];
  if (Math.abs(dx) > eps) {
    const t1 = (0 - cx) / dx;
    const y1 = cy + t1 * dy;
    if (t1 > 0 && y1 >= -1 && y1 <= h + 1) cand.push({ t: t1, x: 0, y: y1 });
    const t2 = (w - cx) / dx;
    const y2 = cy + t2 * dy;
    if (t2 > 0 && y2 >= -1 && y2 <= h + 1) cand.push({ t: t2, x: w, y: y2 });
  }
  if (Math.abs(dy) > eps) {
    const t3 = (0 - cy) / dy;
    const x3 = cx + t3 * dx;
    if (t3 > 0 && x3 >= -1 && x3 <= w + 1) cand.push({ t: t3, x: x3, y: 0 });
    const t4 = (h - cy) / dy;
    const x4 = cx + t4 * dx;
    if (t4 > 0 && x4 >= -1 && x4 <= w + 1) cand.push({ t: t4, x: x4, y: h });
  }
  if (cand.length === 0) return { x: clamp(x, 0, w), y: clamp(y, 0, h) };
  cand.sort((a, b) => a.t - b.t);
  const first = cand[0];
  if (!first) {
    return { x: clamp(x, 0, w), y: clamp(y, 0, h) };
  }
  return { x: first.x, y: first.y };
}

function calculateOrbitCenter(
  centerPct: { x: number; y: number },
  stageWidth: number,
  stageHeight: number,
): { cx: number; cy: number } {
  return {
    cx: stageWidth * clamp01(centerPct.x / 100),
    cy: stageHeight * clamp01(centerPct.y / 100),
  };
}

function calculateOrbitRadius(
  centerPx: { cx: number; cy: number },
  positionPct: { xPct: number; yPct: number },
  stageWidth: number,
  stageHeight: number,
): number {
  const bx = stageWidth * ((positionPct.xPct ?? 0) / 100);
  const by = stageHeight * ((positionPct.yPct ?? 0) / 100);
  const start = projectToRectBorder(centerPx.cx, centerPx.cy, bx, by, stageWidth, stageHeight);
  return Math.hypot(start.x - centerPx.cx, start.y - centerPx.cy);
}

function calculateOrbitPhase(
  centerPx: { cx: number; cy: number },
  positionPct: { xPct: number; yPct: number },
  phaseDeg: number | null | undefined,
  stageWidth: number,
  stageHeight: number,
): number {
  if (typeof phaseDeg === "number" && isFinite(phaseDeg)) {
    return toRad(normDeg(phaseDeg));
  }

  const bx = stageWidth * ((positionPct.xPct ?? 0) / 100);
  const by = stageHeight * ((positionPct.yPct ?? 0) / 100);
  const start = projectToRectBorder(centerPx.cx, centerPx.cy, bx, by, stageWidth, stageHeight);
  return Math.atan2(start.y - centerPx.cy, start.x - centerPx.cx);
}

function normalizeOrbitDirection(dir: string | undefined): 1 | -1 {
  return dir === "ccw" ? -1 : (1 as 1 | -1);
}

function normalizeOrientPolicy(policy: string | undefined): "none" | "auto" | "override" {
  if (policy === "auto" || policy === "override") return policy;
  return "none";
}

// Create orbit manager
export function createLayerOrbitManager(): LayerOrbitManager {
  const items: OrbitItem[] = [];
  let _app: GenericApplication | null = null;

  return {
    init(app: GenericApplication, built: BuiltLayer[], spinRpmBySprite?: Map<GenericSprite, number>) {
      _app = app;
      items.length = 0;

      for (const b of built) {
        const rpm = clampRpm60(b.cfg.orbitRPM);
        if (rpm <= 0) continue;

        const dir = normalizeOrbitDirection(b.cfg.orbitDir);
        const radPerSec = (rpm * Math.PI) / 30;
        const centerPct = b.cfg.orbitCenter ?? { xPct: 50, yPct: 50 };
        const centerPx = calculateOrbitCenter(centerPct, STAGE_WIDTH, STAGE_HEIGHT);
        const radius = calculateOrbitRadius(
          centerPx,
          { xPct: b.cfg.position.xPct, yPct: b.cfg.position.yPct },
          STAGE_WIDTH,
          STAGE_HEIGHT,
        );
        const basePhase = calculateOrbitPhase(
          centerPx,
          { xPct: b.cfg.position.xPct, yPct: b.cfg.position.yPct },
          b.cfg.orbitPhaseDeg,
          STAGE_WIDTH,
          STAGE_HEIGHT,
        );
        const orientPolicy = normalizeOrientPolicy(b.cfg.orbitOrientPolicy);
        const orientDegRad = toRad(b.cfg.orbitOrientDeg ?? 0);
        const spinRpm = spinRpmBySprite?.get(b.sprite) ?? clampRpm60(b.cfg.spinRPM);

        const item: OrbitItem = {
          sprite: b.sprite,
          cfg: b.cfg,
          dir,
          radPerSec,
          centerPct,
          centerPx,
          radius,
          basePhase,
          orientPolicy,
          orientDegRad,
          spinRpm,
        };

        items.push(item);
      }
    },

    tick(elapsed: number) {
      for (const item of items) {
        const phase = item.basePhase + item.dir * item.radPerSec * elapsed;
        const x = item.centerPx.cx + item.radius * Math.cos(phase);
        const y = item.centerPx.cy + item.radius * Math.sin(phase);

        item.sprite.x = x;
        item.sprite.y = y;

        // Handle orientation
        if (item.orientPolicy === "auto") {
          item.sprite.rotation = phase + Math.PI / 2; // Perpendicular to orbit
        } else if (item.orientPolicy === "override") {
          item.sprite.rotation = item.orientDegRad;
        }

        // Apply spin if configured
        if (item.spinRpm > 0) {
          const spinRadPerSec = (item.spinRpm * Math.PI) / 30;
          item.sprite.rotation += spinRadPerSec * elapsed;
        }
      }
    },

    recompute(elapsed: number) {
      // Recalculate stage-dependent values for all items
      for (const item of items) {
        item.centerPx = calculateOrbitCenter(item.centerPct, STAGE_WIDTH, STAGE_HEIGHT);
      }
    },

    dispose() {
      items.length = 0;
      _app = null;
    },

    getItems(): OrbitItem[] {
      return [...items];
    },
  };
}

// ===================================================================
// LAYER EFFECT MANAGER IMPLEMENTATION
// Self-contained visual effects system
// ===================================================================

// Effect utility functions
function pingPong(t: number): number {
  if (t > 0.5) return 1 - (t - 0.5) * 2;
  return t * 2;
}

function easeLinear(t: number): number {
  return t;
}

function easeSineInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * 2 * t);
}

function canUseAdvanced(webglCapable: boolean = true): boolean {
  // @ts-ignore
  const mem = (navigator as any).deviceMemory as number | undefined;
  const cores = navigator.hardwareConcurrency || 4;
  const okHW = (mem === undefined || mem >= 4) && cores >= 4;
  return webglCapable && okHW;
}

// Effect normalization functions
function normFade(e: any): FadeSpec {
  return {
    type: "fade",
    from: typeof e.from === "number" ? e.from : 1,
    to: typeof e.to === "number" ? e.to : 1,
    durationMs: typeof e.durationMs === "number" && e.durationMs > 0 ? e.durationMs : 1000,
    loop: e.loop !== false,
    easing: e.easing === "sineInOut" ? "sineInOut" : "linear",
  };
}

function normPulse(e: any): PulseSpec {
  return {
    type: "pulse",
    property: e.property === "alpha" ? "alpha" : "scale",
    amp: typeof e.amp === "number" ? e.amp : e.property === "alpha" ? 0.1 : 0.05,
    periodMs: typeof e.periodMs === "number" && e.periodMs > 0 ? e.periodMs : 1000,
    phaseDeg: typeof e.phaseDeg === "number" ? e.phaseDeg : 0,
  };
}

function normGlow(e: any): GlowSpec {
  return {
    type: "glow",
    color: typeof e.color === "number" ? e.color : 0xffff00,
    alpha: typeof e.alpha === "number" ? e.alpha : 0.4,
    scale: typeof e.scale === "number" ? e.scale : 0.15,
    pulseMs: typeof e.pulseMs === "number" ? e.pulseMs : undefined,
  };
}

function normBloom(e: any): BloomSpec {
  return {
    type: "bloom",
    strength: typeof e.strength === "number" ? e.strength : 0.6,
  };
}

function normDistort(e: any): DistortSpec {
  return {
    type: "distort",
    ampPx: typeof e.ampPx === "number" ? e.ampPx : 2,
    speed: typeof e.speed === "number" ? e.speed : 0.5,
  };
}

function normShockwave(e: any): ShockwaveSpec {
  return {
    type: "shockwave",
    periodMs: typeof e.periodMs === "number" ? e.periodMs : 1200,
    maxScale: typeof e.maxScale === "number" ? e.maxScale : 1.3,
    fade: e.fade !== false,
  };
}

function parseEffects(cfg: { effects?: any }): {
  basic: BasicEffectSpec[];
  advanced: AdvancedEffectSpec[];
} {
  const list = cfg.effects;
  if (!Array.isArray(list) || list.length === 0) {
    return { basic: [], advanced: [] };
  }

  const basic: BasicEffectSpec[] = [];
  const advanced: AdvancedEffectSpec[] = [];

  for (const e of list) {
    if (!e || typeof e !== "object") continue;

    const type = (e as any).type;
    if (type === "fade") basic.push(normFade(e));
    else if (type === "pulse") basic.push(normPulse(e));
    else if (type === "glow") advanced.push(normGlow(e));
    else if (type === "bloom") advanced.push(normBloom(e));
    else if (type === "distort") advanced.push(normDistort(e));
    else if (type === "shockwave") advanced.push(normShockwave(e));
  }

  return { basic, advanced };
}

// Helper function for computing basic effect state
export function computeBasicEffectState(
  effects: BasicEffectSpec[],
  tilt: { prevTiltRad?: number },
  elapsed: number,
  pointer: { px: number; py: number },
): { alpha: number; scaleMul: number; tiltRad: number } {
  let alpha = 1;
  let scaleMul = 1;
  let tiltRad = 0;

  for (const e of effects) {
    if (e.type === "fade") {
      const T = e.durationMs / 1000;
      if (T <= 0) continue;
      let phase = (elapsed % T) / T;
      if (e.loop) {
        phase = pingPong(phase);
      }
      const t = e.easing === "sineInOut" ? easeSineInOut(phase) : easeLinear(phase);
      alpha = e.from + (e.to - e.from) * t;
    } else if (e.type === "pulse") {
      const T = e.periodMs / 1000;
      if (T <= 0) continue;
      const omega = (2 * Math.PI) / T;
      const phase = toRad(e.phaseDeg || 0);
      const s = 1 + e.amp * Math.sin(omega * elapsed + phase);
      if (e.property === "scale") scaleMul *= s;
      else alpha *= clamp01(s);
    }
  }

  return { alpha, scaleMul, tiltRad };
}

// Create effect manager
export function createLayerEffectManager(effectHandler?: EffectHandler): LayerEffectManager {
  let _app: GenericApplication | null = null;
  const items: LayerEffectItem[] = [];

  // Pointer state for tilt effects (0..1)
  let px = 0.5;
  let py = 0.5;
  let hasPointerListeners = false;
  let advancedEffectsEnabled = false;

  const onMouse = (ev: MouseEvent) => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    px = Math.max(0, Math.min(1, ev.clientX / w));
    py = Math.max(0, Math.min(1, ev.clientY / h));
  };

  const onTouch = (ev: TouchEvent) => {
    const t = ev.touches && ev.touches[0];
    if (!t) return;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    px = Math.max(0, Math.min(1, t.clientX / w));
    py = Math.max(0, Math.min(1, t.clientY / h));
  };

  function installPointerListeners() {
    if (hasPointerListeners) return;
    try {
      window.addEventListener("mousemove", onMouse, { passive: true });
      window.addEventListener("touchmove", onTouch, { passive: true });
      hasPointerListeners = true;
    } catch {}
  }

  function removePointerListeners() {
    if (!hasPointerListeners) return;
    try {
      window.removeEventListener("mousemove", onMouse as any);
      window.removeEventListener("touchmove", onTouch as any);
      hasPointerListeners = false;
    } catch {}
  }

  return {
    init(app: GenericApplication, built: BuiltLayer[]) {
      _app = app;
      items.length = 0;

      // Check WebGL capability from app renderer if available
      let webglCapable = false;
      try {
        const pixiApp = app as any;
        if (pixiApp && pixiApp.renderer) {
          webglCapable = !!pixiApp.renderer.gl;
        }
      } catch {
        webglCapable = false;
      }

      advancedEffectsEnabled = canUseAdvanced(webglCapable);

      // Check if we need pointer listeners for tilt effects
      let needsPointerListeners = false;

      built.forEach((b, idx) => {
        const effects = parseEffects(b.cfg);
        if (effects.basic.length === 0 && effects.advanced.length === 0) return;

        const baseScale = (b.cfg.scale?.pct ?? 100) / 100;
        const baseAlpha = 1;

        const item: LayerEffectItem = {
          spriteIdx: idx,
          basicSpecs: effects.basic,
          advancedSpecs: advancedEffectsEnabled ? effects.advanced : [],
          baseAlpha,
          baseScale,
          auras: [],
        };

        // Initialize advanced effects if enabled and handler is available
        if (advancedEffectsEnabled && effectHandler && effects.advanced.length > 0) {
          for (const spec of effects.advanced) {
            if (spec.type === "glow" || spec.type === "bloom") {
              const auraSprite = effectHandler.createAuraSprite(b.sprite, spec);
              if (auraSprite) {
                item.auras.push({
                  sprite: auraSprite,
                  baseScale:
                    baseScale *
                    (spec.type === "glow" ? 1 + spec.scale : 1 + 0.2 + spec.strength * 0.2),
                  strength: spec.type === "glow" ? 1 : spec.strength,
                  pulseMs: spec.type === "glow" ? spec.pulseMs : undefined,
                  color: spec.type === "glow" ? spec.color : undefined,
                  alpha: spec.type === "glow" ? spec.alpha : Math.min(1, 0.3 + spec.strength * 0.4),
                });
              }
            } else if (spec.type === "distort") {
              item.distort = {
                ampPx: spec.ampPx,
                speed: spec.speed,
                baseX: b.sprite.x,
                baseY: b.sprite.y,
              };
            } else if (spec.type === "shockwave") {
              item.shock = {
                period: spec.periodMs,
                maxScale: spec.maxScale,
                fade: spec.fade,
                baseScale,
              };
            }
          }
        }

        items.push(item);
      });

      // Install pointer listeners only if needed
      if (needsPointerListeners) {
        installPointerListeners();
      }
    },

    tick(elapsed: number, builtRef: BuiltLayer[]) {
      for (const item of items) {
        const b = builtRef[item.spriteIdx];
        if (!b) continue;

        // Process basic effects first
        const { alpha, scaleMul, tiltRad } = computeBasicEffectState(
          item.basicSpecs,
          { prevTiltRad: item.prevTiltRad },
          elapsed,
          { px, py },
        );

        // Apply basic effects
        b.sprite.alpha = Math.max(0, Math.min(1, alpha));
        const finalScale = item.baseScale * scaleMul;
        if (
          typeof b.sprite.scale === "object" &&
          "set" in b.sprite.scale &&
          typeof b.sprite.scale.set === "function"
        ) {
          b.sprite.scale.set(finalScale, finalScale);
        } else {
          b.sprite.scale.x = finalScale;
          b.sprite.scale.y = finalScale;
        }

        // Apply tilt rotation delta
        const prev = item.prevTiltRad || 0;
        if (tiltRad !== prev) {
          b.sprite.rotation += tiltRad - prev;
          item.prevTiltRad = tiltRad;
        }

        // Process advanced effects (aura sprites, distortion, shockwave)
        for (const a of item.auras) {
          a.sprite.x = b.sprite.x;
          a.sprite.y = b.sprite.y;
          a.sprite.rotation = b.sprite.rotation;
          let s = a.baseScale;
          if (a.pulseMs) {
            const T = a.pulseMs / 1000;
            if (T > 0) s = a.baseScale * (1 + 0.05 * Math.sin(((2 * Math.PI) / T) * elapsed));
          }
          if (
            typeof a.sprite.scale === "object" &&
            "set" in a.sprite.scale &&
            typeof a.sprite.scale.set === "function"
          ) {
            a.sprite.scale.set(s, s);
          } else {
            a.sprite.scale.x = s;
            a.sprite.scale.y = s;
          }
        }

        // Apply distortion (additive position offset)
        if (item.distort) {
          const { ampPx, speed } = item.distort;
          const t = elapsed * speed * 2 * Math.PI;
          b.sprite.x += ampPx * Math.sin(t);
          b.sprite.y += ampPx * Math.cos(t * 0.9);
        }

        // Apply shockwave (overrides scale and optionally alpha)
        if (item.shock) {
          const T = item.shock.period / 1000;
          if (T > 0) {
            const phase = (elapsed % T) / T;
            const mul = 1 + (item.shock.maxScale - 1) * Math.sin(Math.PI * phase);
            const s = item.shock.baseScale * mul;
            if (
              typeof b.sprite.scale === "object" &&
              "set" in b.sprite.scale &&
              typeof b.sprite.scale.set === "function"
            ) {
              b.sprite.scale.set(s, s);
            } else {
              b.sprite.scale.x = s;
              b.sprite.scale.y = s;
            }
            if (item.shock.fade) {
              b.sprite.alpha = 0.8 + 0.2 * Math.cos(Math.PI * phase);
            }
          }
        }
      }
    },

    recompute() {
      // Effects don't need recomputation for resize events
    },

    dispose() {
      // Remove pointer listeners
      removePointerListeners();

      // Clean up aura sprites using effect handler if available
      for (const item of items) {
        for (const aura of item.auras) {
          if (effectHandler) {
            try {
              effectHandler.disposeAuraSprite(aura.sprite);
            } catch {
              // Ignore dispose errors
            }
          }
        }
      }

      items.length = 0;
      _app = null;
    },

    getItems(): LayerEffectItem[] {
      return [...items];
    },

    hasEffects(): boolean {
      return items.length > 0;
    },
  };
}