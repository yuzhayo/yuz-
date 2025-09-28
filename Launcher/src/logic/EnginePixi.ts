import { Application, Assets, Container, Sprite } from "pixi.js";
import React from "react";
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

import type { EffectHandler } from "./LayerEffect";
import type {
  GlowSpec,
  BloomSpec,
  AdvancedEffectSpec,
  LayerEffectItem,
  BasicEffectSpec,
  FadeSpec,
  PulseSpec,
  TiltSpec,
  DistortSpec,
  ShockwaveSpec
} from "./LayerEffect";
import { STAGE_WIDTH, STAGE_HEIGHT } from "@shared/stages/Stage2048";
import {
  toRad,
  toDeg,
  clamp,
  clamp01,
  normDeg,
  clampRpm60,
  isWebGLAvailable,
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

    applyAdvancedEffect(sprite: GenericSprite, spec: AdvancedEffectSpec, elapsed: number): void {
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

// === EMBEDDED LAYER SPIN MANAGER ===
type BasicSpinItem = {
  sprite: Sprite;
  baseRad: number;
  radPerSec: number;
  dir: 1 | -1;
  mode: "basic";
};

type SpinItem = BasicSpinItem;

interface LayerSpinManager {
  init(app: Application, built: BuiltLayer[]): void;
  tick(elapsed: number): void;
  recompute(): void;
  dispose(): void;
  getSpinRpm(sprite: Sprite): number;
  getItems(): SpinItem[];
}

function createLayerSpinManager(): LayerSpinManager {
  const items: SpinItem[] = [];
  const rpmBySprite = new Map<Sprite, number>();
  let _app: Application | null = null;

  return {
    init(application: Application, built: BuiltLayer[]) {
      _app = application;
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
      _app = null;
    },

    getSpinRpm(sprite: Sprite): number {
      return rpmBySprite.get(sprite) ?? 0;
    },

    getItems(): SpinItem[] {
      return [...items];
    },
  };
}

// === EMBEDDED LAYER ORBIT MANAGER ===
type OrbitItem = {
  sprite: Sprite;
  cfg: LayerConfig;
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

interface LayerOrbitManager {
  init(app: Application, built: BuiltLayer[], spinRpmBySprite?: Map<Sprite, number>): void;
  tick(elapsed: number): void;
  recompute(elapsed: number): void;
  dispose(): void;
  getItems(): OrbitItem[];
}

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

function clampOrbitCenter(
  centerConfig: { xPct?: number; yPct?: number } | null | undefined,
  fallback: { xPct: number; yPct: number } = { xPct: 50, yPct: 50 },
): { x: number; y: number } {
  return {
    x: clamp(centerConfig?.xPct ?? fallback.xPct, 0, 100),
    y: clamp(centerConfig?.yPct ?? fallback.yPct, 0, 100),
  };
}

function createLayerOrbitManager(): LayerOrbitManager {
  const items: OrbitItem[] = [];
  let _app: Application | null = null;

  return {
    init(application: Application, built: BuiltLayer[], spinRpmBySprite?: Map<Sprite, number>) {
      _app = application;
      items.length = 0;

      for (const b of built) {
        // Only handle basic orbital motion (clock-driven orbit is handled by LayerClock)
        if (!b.cfg.clock?.enabled) {
          const rpm = clampRpm60(b.cfg.orbitRPM);
          if (rpm <= 0) continue;

          const orbitCenter = b.cfg.orbitCenter || { xPct: 50, yPct: 50 };
          const centerPct = clampOrbitCenter(orbitCenter);
          const dir = b.cfg.orbitDir === "ccw" ? -1 : (1 as 1 | -1);

          const w = STAGE_WIDTH;
          const h = STAGE_HEIGHT;
          const centerPx = calculateOrbitCenter(centerPct, w, h);
          const radius = calculateOrbitRadius(
            centerPx,
            { xPct: b.cfg.position?.xPct ?? 0, yPct: b.cfg.position?.yPct ?? 0 },
            w,
            h,
          );

          if (radius <= 0) continue;

          const basePhase = calculateOrbitPhase(
            centerPx,
            { xPct: b.cfg.position?.xPct ?? 0, yPct: b.cfg.position?.yPct ?? 0 },
            b.cfg.orbitPhaseDeg,
            w,
            h,
          );

          const radPerSec = (rpm * Math.PI) / 30;
          const policy = (b.cfg.orbitOrientPolicy ?? "none") as "none" | "auto" | "override";
          const orientDeg =
            typeof b.cfg.orbitOrientDeg === "number" && isFinite(b.cfg.orbitOrientDeg)
              ? b.cfg.orbitOrientDeg
              : 0;
          const orientDegRad = (orientDeg * Math.PI) / 180;
          const spinRpm = spinRpmBySprite?.get(b.sprite) ?? 0;

          items.push({
            sprite: b.sprite,
            cfg: b.cfg,
            dir,
            radPerSec,
            centerPct,
            centerPx,
            radius,
            basePhase,
            orientPolicy: policy,
            orientDegRad,
            spinRpm,
          });
        }
      }
    },

    tick(elapsed: number) {
      for (const item of items) {
        if (item.radius <= 0) continue;

        const angle = item.basePhase + item.dir * item.radPerSec * elapsed;
        item.sprite.x = item.centerPx.cx + item.radius * Math.cos(angle);
        item.sprite.y = item.centerPx.cy + item.radius * Math.sin(angle);

        // Handle orientation policy
        if (
          item.orientPolicy === "override" ||
          (item.orientPolicy === "auto" && item.spinRpm <= 0)
        ) {
          item.sprite.rotation = angle + item.orientDegRad;
        }
      }
    },

    recompute(elapsed: number) {
      const w = STAGE_WIDTH;
      const h = STAGE_HEIGHT;

      for (const item of items) {
        // Store current angle to maintain continuity
        const oldAngle = Math.atan2(
          item.sprite.y - item.centerPx.cy,
          item.sprite.x - item.centerPx.cx,
        );

        // Recalculate center and radius based on current stage dimensions
        const centerPx = calculateOrbitCenter(item.centerPct, w, h);
        const radius = calculateOrbitRadius(
          centerPx,
          { xPct: item.cfg.position?.xPct ?? 0, yPct: item.cfg.position?.yPct ?? 0 },
          w,
          h,
        );

        item.centerPx = centerPx;
        item.radius = radius;

        if (radius > 0) {
          // Adjust base phase to maintain current position
          const currentBase = oldAngle;
          item.basePhase = currentBase - item.dir * item.radPerSec * elapsed;

          // Update sprite position immediately
          item.sprite.x = centerPx.cx + radius * Math.cos(currentBase);
          item.sprite.y = centerPx.cy + radius * Math.sin(currentBase);
        }
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

// === EMBEDDED LAYER EFFECT MANAGER ===
// Note: GlowSpec, BloomSpec, AdvancedEffectSpec are now imported from LayerEffect.ts

type Aura = {
  sprite: Sprite;
  baseScale: number;
  strength: number;
  pulseMs?: number;
  color?: number;
  alpha: number;
};

type Distort = { 
  ampPx: number; 
  speed: number; 
  baseX: number; 
  baseY: number; 
};

type Shock = { 
  period: number; 
  maxScale: number; 
  fade: boolean; 
  baseScale: number; 
};


interface LayerEffectManager {
  init(app: Application, built: BuiltLayer[]): void;
  tick(elapsed: number, builtRef: BuiltLayer[]): void;
  recompute(): void;
  dispose(): void;
  getItems(): LayerEffectItem[];
  hasEffects(): boolean;
}

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

function normTilt(e: any): TiltSpec {
  const mode: TiltSpec["mode"] = e.mode === "device" || e.mode === "time" ? e.mode : "pointer";
  const axis: TiltSpec["axis"] = e.axis === "x" || e.axis === "y" ? e.axis : "both";
  const maxDeg = typeof e.maxDeg === "number" ? e.maxDeg : 8;
  const periodMs = typeof e.periodMs === "number" && e.periodMs > 0 ? e.periodMs : 4000;
  return { type: "tilt", mode, axis, maxDeg, periodMs };
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

function parseEffects(cfg: LayerConfig): { basic: BasicEffectSpec[]; advanced: AdvancedEffectSpec[] } {
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
    else if (type === "tilt") basic.push(normTilt(e));
    else if (type === "glow") advanced.push(normGlow(e));
    else if (type === "bloom") advanced.push(normBloom(e));
    else if (type === "distort") advanced.push(normDistort(e));
    else if (type === "shockwave") advanced.push(normShockwave(e));
  }

  return { basic, advanced };
}

function canUseAdvanced(): boolean {
  const okGL = isWebGLAvailable();
  // @ts-ignore
  const mem = (navigator as any).deviceMemory as number | undefined;
  const cores = navigator.hardwareConcurrency || 4;
  const okHW = (mem === undefined || mem >= 4) && cores >= 4;
  return okGL && okHW;
}

function easeLinear(t: number): number {
  return t;
}

function easeSineInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * 2 * t);
}

function computeBasicEffectState(
  effects: BasicEffectSpec[],
  tilt: { prevTiltRad?: number },
  elapsed: number,
  pointer: { px: number; py: number }
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
        // ping-pong
        if (phase > 0.5) phase = 1 - (phase - 0.5) * 2;
        else phase = phase * 2;
      }
      const t = e.easing === "sineInOut" ? easeSineInOut(phase) : easeLinear(phase);
      alpha = e.from + (e.to - e.from) * t;
    } else if (e.type === "pulse") {
      const T = e.periodMs / 1000;
      if (T <= 0) continue;
      const omega = (2 * Math.PI) / T;
      const phase = ((e.phaseDeg || 0) * Math.PI) / 180;
      const s = 1 + e.amp * Math.sin(omega * elapsed + phase);
      if (e.property === "scale") scaleMul *= s;
      else alpha *= Math.max(0, Math.min(1, s));
    } else if (e.type === "tilt") {
      const axisCount = e.axis === "both" ? 2 : 1;
      if (e.mode === "time") {
        const T = (e.periodMs ?? 4000) / 1000;
        if (T > 0) {
          const s = Math.sin(((2 * Math.PI) / T) * elapsed);
          const deg = e.maxDeg * s;
          tiltRad += (deg * Math.PI) / 180;
        }
      } else {
        const dx = (pointer.px - 0.5) * 2;
        const dy = (pointer.py - 0.5) * 2;
        let v = 0;
        if (e.axis === "x") v = dy;
        else if (e.axis === "y") v = -dx;
        else v = (dy + -dx) / axisCount;
        const deg = Math.max(-e.maxDeg, Math.min(e.maxDeg, v * e.maxDeg));
        tiltRad += (deg * Math.PI) / 180;
      }
    }
  }

  return { alpha, scaleMul, tiltRad };
}

function createLayerEffectManager(): LayerEffectManager {
  let _app: Application | null = null;
  const items: LayerEffectItem[] = [];
  
  // Pointer state for tilt effects (0..1)
  let px = 0.5;
  let py = 0.5;
  let hasPointerListeners = false;

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

  const advancedEffectsEnabled = canUseAdvanced();

  return {
    init(app: Application, built: BuiltLayer[]) {
      _app = app;
      items.length = 0;

      // Check if we need pointer listeners for tilt effects
      let needsPointerListeners = false;

      built.forEach((b, idx) => {
        const effects = parseEffects(b.cfg);
        if (effects.basic.length === 0 && effects.advanced.length === 0) return;

        // Check for tilt effects that need pointer tracking
        for (const spec of effects.basic) {
          if (spec.type === "tilt" && (spec.mode === "pointer" || spec.mode === "device")) {
            needsPointerListeners = true;
            break;
          }
        }

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

        // Initialize advanced effects if enabled
        if (advancedEffectsEnabled && effects.advanced.length > 0) {
          for (const spec of effects.advanced) {
            if (spec.type === "glow") {
              const auraSprite = new Sprite(b.sprite.texture);
              auraSprite.anchor.set(0.5);
              auraSprite.tint = spec.color;
              auraSprite.alpha = spec.alpha;
              auraSprite.blendMode = 1; // BLEND_MODES.ADD
              const parent = b.sprite.parent;
              if (parent) {
                const index = parent.getChildIndex(b.sprite);
                parent.addChildAt(auraSprite, index);
              }
              item.auras.push({
                sprite: auraSprite,
                baseScale: baseScale * (1 + spec.scale),
                strength: 1,
                pulseMs: spec.pulseMs,
                color: spec.color,
                alpha: spec.alpha,
              });
            } else if (spec.type === "bloom") {
              const auraSprite = new Sprite(b.sprite.texture);
              auraSprite.anchor.set(0.5);
              auraSprite.alpha = Math.min(1, 0.3 + spec.strength * 0.4);
              auraSprite.blendMode = 1; // BLEND_MODES.ADD
              const parent = b.sprite.parent;
              if (parent) {
                const index = parent.getChildIndex(b.sprite);
                parent.addChildAt(auraSprite, index);
              }
              item.auras.push({
                sprite: auraSprite,
                baseScale: baseScale * (1 + 0.2 + spec.strength * 0.2),
                strength: spec.strength,
                alpha: auraSprite.alpha,
              });
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
          { px, py }
        );

        // Apply basic effects
        b.sprite.alpha = Math.max(0, Math.min(1, alpha));
        const finalScale = item.baseScale * scaleMul;
        b.sprite.scale.set(finalScale, finalScale);

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
          a.sprite.scale.set(s, s);
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
            b.sprite.scale.set(s, s); // Override scale from basic effects
            if (item.shock.fade) {
              b.sprite.alpha = 0.8 + 0.2 * Math.cos(Math.PI * phase); // Override alpha from basic effects
            }
          }
        }
      }
    },

    recompute() {
      // Effects don't need recomputation for resize events
      // All effects maintain their state and work with current sprite positions
    },

    dispose() {
      // Remove pointer listeners
      removePointerListeners();

      // Clean up aura sprites
      for (const item of items) {
        for (const aura of item.auras) {
          try {
            aura.sprite.destroy();
          } catch {
            // Ignore destroy errors
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

// === EMBEDDED LAYER CLOCK MANAGER ===
import type { ClockConfig, ClockHand } from "./LayerClock";

type Vec2 = { x: number; y: number };

type TimeSource = {
  mode: "device" | "utc" | "server";
  tzOffsetMinutes?: number | null;
};

type ClockGeometry = {
  baseLocal: Vec2;
  tipLocal: Vec2;
  baseTipAngle: number;
  baseTipLength: number;
  sourceWidth: number;
  sourceHeight: number;
};

type SpinRadius = {
  value: number | null;
  pct: number | null;
};

type SpinSettings = {
  hand: ClockHand | null;
  radius: SpinRadius;
  staticAngle: number;
  phase: number;
};

type OrbitSettings = {
  hand: ClockHand | null;
  centerPct: { xPct: number; yPct: number };
  centerPx: Vec2;
  radius: number;
  phase: number;
};

type ClockItem = {
  sprite: Sprite;
  cfg: LayerConfig;
  clock: ClockConfig;
  geometry: ClockGeometry;
  positionFallback: { xPct: number; yPct: number };
  centerPct: { xPct: number; yPct: number };
  centerPx: Vec2;
  spin: SpinSettings;
  orbit: OrbitSettings | null;
  time: { source: TimeSource; smooth: boolean; format: 12 | 24 };
};

interface LayerClockManager {
  init(app: Application, built: BuiltLayer[]): void;
  tick(): void;
  recompute(): void;
  dispose(): void;
  getItems(): ClockItem[];
}

// Clock utility functions
function getSpriteDimensions(sp: Sprite): { width: number; height: number } | null {
  const tex = sp.texture;
  const width = tex.orig?.width ?? tex.width ?? sp.width;
  const height = tex.orig?.height ?? tex.height ?? sp.height;
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

function rotateVec(v: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: v.x * c - v.y * s,
    y: v.x * s + v.y * c,
  };
}

function computeClockGeometry(sprite: Sprite, clock: ClockConfig, layerId: string): ClockGeometry | null {
  const dims = getSpriteDimensions(sprite);
  if (!dims) {
    console.warn("[EnginePixi] missing texture dimensions for", layerId);
    return null;
  }

  const baseAngle = toRad(clock.base?.angleDeg ?? 0);
  const tipAngle = toRad(clock.tip?.angleDeg ?? 0);
  const baseLocal = pointOnRect(dims.width, dims.height, baseAngle);
  const tipLocal = pointOnRect(dims.width, dims.height, tipAngle);
  const baseTipVec = { x: tipLocal.x - baseLocal.x, y: tipLocal.y - baseLocal.y };
  const baseTipLength = Math.hypot(baseTipVec.x, baseTipVec.y);

  if (!isFinite(baseTipLength) || baseTipLength <= 1e-3) {
    console.warn("[EnginePixi] invalid base/tip configuration for", layerId);
    return null;
  }

  const baseTipAngle = Math.atan2(baseTipVec.y, baseTipVec.x);
  return {
    baseLocal,
    tipLocal,
    baseTipAngle,
    baseTipLength,
    sourceWidth: dims.width,
    sourceHeight: dims.height,
  };
}

function resolveTimeSource(clock: ClockConfig): TimeSource {
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

function clampCenter(
  center: ClockConfig["center"] | null | undefined,
  fallback: { xPct: number; yPct: number },
): { xPct: number; yPct: number } {
  const x = typeof center?.xPct === "number" && isFinite(center.xPct) ? center.xPct : fallback.xPct;
  const y = typeof center?.yPct === "number" && isFinite(center.yPct) ? center.yPct : fallback.yPct;
  return {
    xPct: clamp(x, 0, 100),
    yPct: clamp(y, 0, 100),
  };
}

function pctToStage(center: { xPct: number; yPct: number }): Vec2 {
  return {
    x: (center.xPct / 100) * STAGE_WIDTH,
    y: (center.yPct / 100) * STAGE_HEIGHT,
  };
}

function resolveSpinRadius(clock: ClockConfig): SpinRadius {
  const rawValue = clock.spinRadius?.value;
  const value = typeof rawValue === "number" && isFinite(rawValue) ? Math.max(0, rawValue) : null;
  const rawPct = clock.spinRadius?.pct;
  const pct = typeof rawPct === "number" && isFinite(rawPct) ? Math.max(0, rawPct) / 100 : null;
  return { value, pct };
}

function resolveSpinRadiusPx(item: ClockItem, maxScale: number): number {
  if (item.spin.radius.value != null) return item.spin.radius.value;
  if (item.spin.radius.pct != null && item.geometry) {
    return item.spin.radius.pct * item.geometry.baseTipLength * maxScale;
  }
  return 0;
}

function createLayerClockManager(): LayerClockManager {
  const items: ClockItem[] = [];
  let _app: Application | null = null;

  const createClockItem = (b: BuiltLayer): ClockItem | null => {
    const clock = b.cfg.clock;
    if (!clock || !clock.enabled) return null;

    const geometry = computeClockGeometry(b.sprite, clock, b.cfg.id);
    if (!geometry) return null;

    const positionFallback = { xPct: b.cfg.position.xPct ?? 0, yPct: b.cfg.position.yPct ?? 0 };
    const centerPct = clampCenter(clock.center, positionFallback);
    const centerPx = pctToStage(centerPct);

    const spinHand = clock.spinHand && clock.spinHand !== "none" ? clock.spinHand : null;
    const orbitHand = clock.orbitHand && clock.orbitHand !== "none" ? clock.orbitHand : null;

    const timeSource = resolveTimeSource(clock);
    const smooth = clock.smooth ?? true;
    const format = clock.format === 24 ? 24 : 12;

    // Calculate initial spin phase
    const parts = getTimeParts(timeSource);
    const currentAngle = spinHand ? timeAngleRad(parts, spinHand, format, smooth) : 0;
    const staticAngle = toRad(clock.tip?.angleDeg ?? 0);
    const spinPhase = spinHand ? staticAngle - currentAngle : 0;

    const spin: SpinSettings = {
      hand: spinHand,
      radius: resolveSpinRadius(clock),
      staticAngle,
      phase: spinPhase,
    };

    let orbit: OrbitSettings | null = null;
    if (orbitHand) {
      const orbitCenterPct = clampCenter(clock.orbitCenter, centerPct);
      const orbitCenterPx = pctToStage(orbitCenterPct);
      const dx = centerPx.x - orbitCenterPx.x;
      const dy = centerPx.y - orbitCenterPx.y;
      const radius = Math.hypot(dx, dy);
      if (radius <= 1e-3) {
        console.warn("[EnginePixi] orbitHand set but radius is zero for", b.cfg.id);
        orbit = {
          hand: null,
          centerPct: orbitCenterPct,
          centerPx: orbitCenterPx,
          radius: 0,
          phase: 0,
        };
      } else {
        const nowAngle = timeAngleRad(parts, orbitHand, format, smooth);
        orbit = {
          hand: orbitHand,
          centerPct: orbitCenterPct,
          centerPx: orbitCenterPx,
          radius,
          phase: Math.atan2(dy, dx) - nowAngle,
        };
      }
    }

    return {
      sprite: b.sprite,
      cfg: b.cfg,
      clock,
      geometry,
      positionFallback,
      centerPct,
      centerPx,
      spin,
      orbit,
      time: { source: timeSource, smooth, format },
    };
  };

  const recomputeItem = (item: ClockItem) => {
    item.centerPct = clampCenter(item.clock.center, item.positionFallback);
    item.centerPx = pctToStage(item.centerPct);

    if (item.orbit) {
      item.orbit.centerPct = clampCenter(item.clock.orbitCenter, item.centerPct);
      item.orbit.centerPx = pctToStage(item.orbit.centerPct);
      const dx = item.centerPx.x - item.orbit.centerPx.x;
      const dy = item.centerPx.y - item.orbit.centerPx.y;
      const radius = Math.hypot(dx, dy);
      item.orbit.radius = radius;
      if (item.orbit.hand && radius > 1e-3) {
        const parts = getTimeParts(item.time.source);
        const nowAngle = timeAngleRad(parts, item.orbit.hand, item.time.format, item.time.smooth);
        item.orbit.phase = Math.atan2(dy, dx) - nowAngle;
      } else {
        if (item.orbit.hand) console.warn("[EnginePixi] orbit radius collapsed for", item.cfg.id);
        item.orbit.phase = radius > 1e-3 ? Math.atan2(dy, dx) : 0;
        if (radius <= 1e-3) item.orbit.hand = null;
      }
    }

    const geom = computeClockGeometry(item.sprite, item.clock, item.cfg.id);
    if (geom) item.geometry = geom;

    // Update spin settings
    item.spin.radius = resolveSpinRadius(item.clock);
  };

  const tickClock = (items: ClockItem[]) => {
    if (items.length === 0) return;

    for (const item of items) {
      const parts = getTimeParts(item.time.source);
      const smooth = item.time.smooth;
      const format = item.time.format;

      let centerX = item.centerPx.x;
      let centerY = item.centerPx.y;

      // Handle orbital motion for clock hands
      if (item.orbit) {
        if (item.orbit.radius > 1e-3) {
          const orbitAngle =
            (item.orbit.hand ? timeAngleRad(parts, item.orbit.hand, format, smooth) : 0) +
            item.orbit.phase;
          centerX = item.orbit.centerPx.x + item.orbit.radius * Math.cos(orbitAngle);
          centerY = item.orbit.centerPx.y + item.orbit.radius * Math.sin(orbitAngle);
        } else {
          centerX = item.orbit.centerPx.x;
          centerY = item.orbit.centerPx.y;
        }
      }

      // Handle clock-driven spin
      if (item.spin.hand) {
        const spinAngle = timeAngleRad(parts, item.spin.hand, format, smooth) + item.spin.phase;

        const scaleX = item.sprite.scale.x;
        const scaleY = item.sprite.scale.y;
        const maxScale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
        const radiusPx = resolveSpinRadiusPx(item, maxScale);

        const baseX = centerX + radiusPx * Math.cos(spinAngle);
        const baseY = centerY + radiusPx * Math.sin(spinAngle);

        const rotation = spinAngle - item.geometry.baseTipAngle;
        const baseOffset = rotateVec(
          {
            x: item.geometry.baseLocal.x * scaleX,
            y: item.geometry.baseLocal.y * scaleY,
          },
          rotation,
        );

        item.sprite.x = baseX - baseOffset.x;
        item.sprite.y = baseY - baseOffset.y;
        item.sprite.rotation = rotation;
      } else if (item.orbit) {
        // For orbital items without spin, just update position
        item.sprite.x = centerX;
        item.sprite.y = centerY;
      }
    }
  };

  return {
    init(application: Application, built: BuiltLayer[]) {
      _app = application;
      items.length = 0;

      for (const b of built) {
        const item = createClockItem(b);
        if (item) items.push(item);
      }
    },

    tick() {
      tickClock(items);
    },

    recompute() {
      for (const item of items) recomputeItem(item);
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
        spinRpmBySprite.set(b.sprite, spinManager.getSpinRpm(b.sprite));
      }

      const orbitManager = createLayerOrbitManager();
      orbitManager.init(app, built, spinRpmBySprite);

      // Effects (unified system)
      const effectManager = createLayerEffectManager();
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
    console.warn("[buildSceneFromLogic] Non-Pixi application detected, DOM support limited");
    // For DOM or other engines, we could create a DOM sprite factory here
    // But for now, we'll let LayerCreator handle the lack of sprite factory
  }
  
  const layerCreatorManager = createLayerCreatorManager(spriteFactory);
  return await layerCreatorManager.init(app, cfg, effectHandler);
}

// === CONSOLIDATED ENGINE ADAPTER ===
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
        // Lazy load DOM engine to avoid circular dependencies
        const domModule = await import("./EngineDom");
        this.engine = domModule.createDomEngine();
        const domOpts: any = {
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

// === CONSOLIDATED LOGIC RENDERER ===
export type LogicRendererProps = {
  cfg: LogicConfig;
  renderer?: RendererType;
  className?: string;
};

export function LogicRenderer(props: LogicRendererProps) {
  const { cfg, renderer = "pixi" } = props;
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let handle: EngineAdapterHandle | null = null;

    let cancelled = false;
    (async () => {
      try {
        handle = await mountRenderer(el, cfg, renderer, { 
          dprCap: 2, 
          resizeTo: window 
        });
      } catch (e) {
        if (!cancelled) {
          console.error(`[LogicRenderer] Failed to mount ${renderer} renderer:`, e);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        handle?.dispose();
      } catch (error) {
        console.error(`[LogicRenderer] Error disposing ${renderer} renderer:`, error);
      }
    };
  }, [cfg, renderer]);

  return React.createElement("div", { 
    ref, 
    className: props.className ?? "w-full h-full" 
  });
}

// Export default for LogicRenderer
export default LogicRenderer;

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
  isWebGLAvailable,
  logicZIndexFor,
  logicApplyBasicTransform
} from "./LayerCreator";