/**
 * LayerEffect.ts - Modular Layer Effect Processing System
 *
 * ⚠️  AI AGENT CRITICAL INSTRUCTIONS:
 *
 * This file is organized into ISOLATED BLOCKS. Each block is marked as:
 * 🔴 CRITICAL - DO NOT DELETE (breaks core functionality)
 * 🟡 OPTIONAL - Safe to delete (removes effects but basic display works)
 * 🟢 UTILITY - Safe to delete (math helpers only, no visual impact)
 *
 * Deleting any 🔴 CRITICAL block will break the application!
 * 🟡 OPTIONAL blocks can be safely removed to reduce features.
 * 🟢 UTILITY blocks provide math helpers and can be deleted.
 */

// Import core contracts from centralized location
import type { GenericSprite, GenericApplication, BuiltLayer } from "./LayerCreator";

// ===================================================================
// 🟢 BLOCK 1: UTILITY MATH FUNCTIONS AND CAPABILITY DETECTION
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete if not needed
// Math helpers for angles, easing, and hardware capability detection
// ===================================================================

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

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

// Check if advanced effects can be used
function canUseAdvanced(webglCapable: boolean = true): boolean {
  // Advanced effects require WebGL renderer capability
  // This parameter should be set based on actual Pixi renderer type

  // Also check hardware capabilities
  // @ts-ignore
  const mem = (navigator as any).deviceMemory as number | undefined;
  const cores = navigator.hardwareConcurrency || 4;
  const okHW = (mem === undefined || mem >= 4) && cores >= 4;

  return webglCapable && okHW;
}

// ===================================================================
// 🔴 BLOCK 2: EFFECT TYPE DEFINITIONS AND INTERFACES
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Core types for effect specifications and engine interfaces
// ===================================================================

// Effect types for LayerConfig
export type LayerEffectConfig = Array<
  | {
      type: "fade";
      from?: number; // 0..1, default 1
      to?: number; // 0..1, default 1
      durationMs?: number; // default 1000
      loop?: boolean; // default true (ping-pong)
      easing?: "linear" | "sineInOut"; // default 'linear'
    }
  | {
      type: "pulse";
      property?: "scale" | "alpha"; // default 'scale'
      amp?: number; // default 0.05 (5%) for scale, or 0.1 for alpha
      periodMs?: number; // default 1000
      phaseDeg?: number; // default 0
    }
  | {
      // Lightweight rotation offset added after spin/orbit/clock.
      // Useful for subtle interactive parallax.
      type: "tilt";
      mode?: "pointer" | "device" | "time"; // default 'pointer'
      axis?: "both" | "x" | "y"; // default 'both'
      maxDeg?: number; // default 8
      periodMs?: number; // only for mode 'time' (default 4000)
    }
  | {
      type: "glow";
      color?: number; // 0xRRGGBB
      alpha?: number; // 0..1 default 0.4
      scale?: number; // default 0.15 (relative extra scale)
      pulseMs?: number; // optional pulsing period
    }
  | {
      type: "bloom";
      strength?: number; // default 0.6
      threshold?: number; // default 0.5 (only for future real bloom)
    }
  | {
      type: "distort";
      ampPx?: number; // default 2 px of jitter
      speed?: number; // default 0.5 cycles/sec
    }
  | {
      type: "shockwave";
      periodMs?: number; // default 1200
      maxScale?: number; // default 1.3
      fade?: boolean; // default true
    }
>;

// Basic effect type definitions
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

export type TiltSpec = {
  type: "tilt";
  mode: "pointer" | "device" | "time";
  axis: "both" | "x" | "y";
  maxDeg: number;
  periodMs?: number;
};

export type BasicEffectSpec = FadeSpec | PulseSpec | TiltSpec;

// Advanced effect type definitions
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

export type AdvancedEffectSpec = GlowSpec | BloomSpec | DistortSpec | ShockwaveSpec;

// Engine-agnostic aura interface for glow/bloom effects
type Aura = {
  sprite: GenericSprite;
  baseScale: number;
  strength: number;
  pulseMs?: number;
  color?: number;
  alpha: number;
};

// Distort state
type Distort = {
  ampPx: number;
  speed: number;
  baseX: number;
  baseY: number;
};

// Shockwave state
type Shock = {
  period: number;
  maxScale: number;
  fade: boolean;
  baseScale: number;
};

// Unified effect item
export type LayerEffectItem = {
  spriteIdx: number;
  basicSpecs: BasicEffectSpec[];
  advancedSpecs: AdvancedEffectSpec[];
  baseAlpha: number;
  baseScale: number;
  prevTiltRad?: number;
  // Advanced effect state
  auras: Aura[];
  distort?: Distort;
  shock?: Shock;
};

// Engine-specific effect handler interface (kept engine-agnostic)
export interface EffectHandler {
  createAuraSprite(originalSprite: GenericSprite, spec: GlowSpec | BloomSpec): GenericSprite | null;
  applyAdvancedEffect(sprite: GenericSprite, spec: AdvancedEffectSpec, elapsed: number): void;
  disposeAuraSprite(sprite: GenericSprite): void;
}

// ===================================================================
// 🔴 BLOCK 3: CONFIG NORMALIZATION FUNCTIONS
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Handles effect config parsing and normalization
// ===================================================================

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
    else if (type === "tilt") basic.push(normTilt(e));
    else if (type === "glow") advanced.push(normGlow(e));
    else if (type === "bloom") advanced.push(normBloom(e));
    else if (type === "distort") advanced.push(normDistort(e));
    else if (type === "shockwave") advanced.push(normShockwave(e));
  }

  return { basic, advanced };
}

// ===================================================================
// 🔴 BLOCK 4: MANAGER INTERFACE AND FACTORY
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Core manager interface that external code depends on
// ===================================================================

// Engine-agnostic layer effect manager interface
export interface LayerEffectManager {
  init(app: GenericApplication, built: BuiltLayer[]): void;
  tick(elapsed: number, builtRef: BuiltLayer[]): void;
  recompute(): void;
  dispose(): void;
  getItems(): LayerEffectItem[];
  hasEffects(): boolean;
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
        // Use ping-pong helper from utility block
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
    } else if (e.type === "tilt") {
      const axisCount = e.axis === "both" ? 2 : 1;
      if (e.mode === "time") {
        const T = (e.periodMs ?? 4000) / 1000;
        if (T > 0) {
          const s = Math.sin(((2 * Math.PI) / T) * elapsed);
          const deg = e.maxDeg * s;
          tiltRad += toRad(deg);
        }
      } else {
        const dx = (pointer.px - 0.5) * 2;
        const dy = (pointer.py - 0.5) * 2;
        let v = 0;
        if (e.axis === "x") v = dy;
        else if (e.axis === "y") v = -dx;
        else v = (dy + -dx) / axisCount;
        const deg = Math.max(-e.maxDeg, Math.min(e.maxDeg, v * e.maxDeg));
        tiltRad += toRad(deg);
      }
    }
  }

  return { alpha, scaleMul, tiltRad };
}

// ===================================================================
// 🔴 BLOCK 5: CORE IMPLEMENTATION
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Main implementation that manages layer effects and animations
// ===================================================================

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
          // Check if renderer has WebGL context (gl property)
          webglCapable = !!pixiApp.renderer.gl;
        }
      } catch {
        // If we can't determine renderer type, assume WebGL is not available
        webglCapable = false;
      }

      advancedEffectsEnabled = canUseAdvanced(webglCapable);

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

// ===================================================================
// 🟡 BLOCK 6: OPTIONAL WEBGL/RENDERER FEATURE GUARDS AND LOGGING
// ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes advanced features)
// WebGL capability detection and optional logging for debugging
// ===================================================================

// Export convenience functions for backward compatibility
export function createEffectManager(): LayerEffectManager {
  return createLayerEffectManager();
}
