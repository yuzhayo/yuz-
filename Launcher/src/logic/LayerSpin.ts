import type { Application, Sprite } from "pixi.js";
import type { BuiltLayer } from "./LogicTypes";
import type { ClockConfig, ClockHand } from "./sceneTypes";
import { clampRpm60, clamp, toRad } from "./LogicMath";
import { STAGE_WIDTH, STAGE_HEIGHT } from "@shared/stages/Stage2048";

// Basic RPM-based spin item
export type BasicSpinItem = {
  sprite: Sprite;
  baseRad: number;
  radPerSec: number;
  dir: 1 | -1;
  mode: "basic";
};

// Clock-driven spin item with time calculations
export type SpinRadius = {
  value: number | null;
  pct: number | null;
};

type ClockSpinItem = {
  sprite: Sprite;
  mode: "clock";
  clock: ClockConfig;
  cfg: BuiltLayer["cfg"];
  hand: ClockHand;
  radius: SpinRadius;
  staticAngle: number;
  phase: number;
  centerPct: { xPct: number; yPct: number };
  centerPx: { x: number; y: number };
  timeSource: TimeSource;
  smooth: boolean;
  format: 12 | 24;
  geometry: ClockGeometry | null;
};

export type SpinItem = BasicSpinItem | ClockSpinItem;

type TimeSource = {
  mode: "device" | "utc" | "server";
  tzOffsetMinutes?: number | null;
};

type Vec2 = { x: number; y: number };

type ClockGeometry = {
  baseLocal: Vec2;
  tipLocal: Vec2;
  baseTipAngle: number;
  baseTipLength: number;
  sourceWidth: number;
  sourceHeight: number;
};

// Consolidated spin manager for all spin types
export interface LayerSpinManager {
  init(app: Application, built: BuiltLayer[]): void;
  tick(elapsed: number): void;
  recompute(): void;
  dispose(): void;
  getSpinRpm(sprite: Sprite): number;
  getItems(): SpinItem[];
}

// Utility functions for clock geometry
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

function computeClockGeometry(
  sprite: Sprite,
  clock: ClockConfig,
  layerId: string,
): ClockGeometry | null {
  const dims = getSpriteDimensions(sprite);
  if (!dims) {
    console.warn("[LayerSpin][clock] Missing texture dimensions for layer", layerId);
    return null;
  }

  const baseAngle = toRad(clock.base?.angleDeg ?? 0);
  const tipAngle = toRad(clock.tip?.angleDeg ?? 0);
  const baseLocal = pointOnRect(dims.width, dims.height, baseAngle);
  const tipLocal = pointOnRect(dims.width, dims.height, tipAngle);
  const baseTipVec = { x: tipLocal.x - baseLocal.x, y: tipLocal.y - baseLocal.y };
  const baseTipLength = Math.hypot(baseTipVec.x, baseTipVec.y);

  if (!isFinite(baseTipLength) || baseTipLength <= 1e-3) {
    console.warn("[LayerSpin][clock] Invalid base/tip configuration for layer", layerId);
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

function resolveSpinRadiusPx(item: ClockSpinItem, maxScale: number): number {
  if (item.radius.value != null) return item.radius.value;
  if (item.radius.pct != null && item.geometry) {
    return item.radius.pct * item.geometry.baseTipLength * maxScale;
  }
  return 0;
}

// Create unified spin manager
export function createLayerSpinManager(): LayerSpinManager {
  const items: SpinItem[] = [];
  const rpmBySprite = new Map<Sprite, number>();
  let app: Application | null = null;

  return {
    init(application: Application, built: BuiltLayer[]) {
      app = application;
      items.length = 0;
      rpmBySprite.clear();

      for (const b of built) {
        const clk = b.cfg.clock;

        // Clock-driven spin
        if (clk?.enabled && clk.spinHand && clk.spinHand !== "none") {
          const geometry = computeClockGeometry(b.sprite, clk, b.cfg.id);
          if (geometry) {
            const positionFallback = {
              xPct: b.cfg.position.xPct ?? 0,
              yPct: b.cfg.position.yPct ?? 0,
            };
            const centerPct = clampCenter(clk.center, positionFallback);
            const centerPx = pctToStage(centerPct);
            const timeSource = resolveTimeSource(clk);
            const smooth = clk.smooth ?? true;
            const format = clk.format === 24 ? 24 : 12;

            // Calculate initial phase based on current time (similar to original logic)
            const parts = getTimeParts(timeSource);
            const currentAngle = timeAngleRad(parts, clk.spinHand, format, smooth);
            const staticAngle = toRad(clk.tip?.angleDeg ?? 0);
            // Phase should align current position with configured static angle
            const phase = staticAngle - currentAngle;

            const clockItem: ClockSpinItem = {
              sprite: b.sprite,
              mode: "clock",
              clock: clk,
              cfg: b.cfg,
              hand: clk.spinHand,
              radius: resolveSpinRadius(clk),
              staticAngle,
              phase,
              centerPct,
              centerPx,
              timeSource,
              smooth,
              format,
              geometry,
            };

            items.push(clockItem);
            rpmBySprite.set(b.sprite, 0); // Clock overrides RPM
          }
        }
        // Basic RPM-based spin
        else {
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
        }
      }
    },

    tick(elapsed: number) {
      for (const item of items) {
        if (item.mode === "basic") {
          // Basic RPM-based spin
          item.sprite.rotation = item.baseRad + item.dir * item.radPerSec * elapsed;
        } else if (item.mode === "clock") {
          // Clock-driven spin with time calculations
          const parts = getTimeParts(item.timeSource);
          const spinAngle = timeAngleRad(parts, item.hand, item.format, item.smooth) + item.phase;

          if (item.geometry) {
            const scaleX = item.sprite.scale.x;
            const scaleY = item.sprite.scale.y;
            const maxScale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
            const radiusPx = resolveSpinRadiusPx(item, maxScale);

            const baseX = item.centerPx.x + radiusPx * Math.cos(spinAngle);
            const baseY = item.centerPx.y + radiusPx * Math.sin(spinAngle);

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
          } else {
            // Fallback to simple rotation
            item.sprite.rotation = spinAngle;
          }
        }
      }
    },

    recompute() {
      if (!app) return;

      for (const item of items) {
        if (item.mode === "clock") {
          // Recompute clock geometry and centers on resize
          const positionFallback = {
            xPct: item.cfg.position.xPct ?? 0,
            yPct: item.cfg.position.yPct ?? 0,
          };
          item.centerPct = clampCenter(item.clock.center, positionFallback);
          item.centerPx = pctToStage(item.centerPct);
          item.geometry = computeClockGeometry(item.sprite, item.clock, item.cfg.id);
          item.radius = resolveSpinRadius(item.clock);
        }
      }
    },

    dispose() {
      items.length = 0;
      rpmBySprite.clear();
      app = null;
    },

    getSpinRpm(sprite: Sprite): number {
      return rpmBySprite.get(sprite) ?? 0;
    },

    getItems(): SpinItem[] {
      return [...items];
    },
  };
}

// Export convenience functions
export function createSpinManager(): LayerSpinManager {
  return createLayerSpinManager();
}

// Re-export math utilities for convenience
export { clampRpm60, toRad } from "./LogicMath";
