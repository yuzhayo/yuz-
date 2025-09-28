const DEBUG_CLOCK = import.meta.env?.VITE_CLOCK_DEBUG === "1";

const WARNED_CLOCK = new Set<string>();
function warnClock(layerId: string, message: string) {
  const key = `${layerId}:${message}`;
  if (WARNED_CLOCK.has(key)) return;
  WARNED_CLOCK.add(key);
  console.warn("[logic][clock]", message, "layer", layerId);
}

function debugClock(layerId: string, ...data: unknown[]) {
  if (!DEBUG_CLOCK) return;
  console.info("[logic][clock][debug]", layerId, ...data);
}

import type { GenericSprite, GenericApplication, BuiltLayer, LayerConfig } from "./LayerCreator";

// Clock-related types (moved from sceneTypes.ts)
export type ClockHand = "second" | "minute" | "hour";
export type ClockHandSelection = ClockHand | "none";

export type ClockCenterConfig = {
  xPct?: number | null;
  yPct?: number | null;
};

export type ClockAngleConfig = {
  angleDeg?: number | null;
};

export type ClockRadiusConfig = {
  pct?: number | null; // percentage of distance from center to edge (0..100)
  value?: number | null; // absolute pixels (post-scale)
};

export type ClockConfig = {
  enabled: boolean;
  center?: ClockCenterConfig | null;
  base?: ClockAngleConfig | null;
  tip?: ClockAngleConfig | null;
  timezone?: "device" | "utc" | "server";
  spinHand?: ClockHandSelection;
  spinRadius?: ClockRadiusConfig | null;
  orbitHand?: ClockHandSelection;
  orbitCenter?: ClockCenterConfig | null;
  smooth?: boolean | null;
  format?: 12 | 24;
  source?: {
    tzOffsetMinutes?: number | null;
  };
};
import { clamp, toRad } from "./LayerCreator";
import { STAGE_WIDTH, STAGE_HEIGHT } from "@shared/stages/Stage2048";
import type { Application } from "pixi.js";

// Type definitions
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

export type SpinRadius = {
  value: number | null;
  pct: number | null;
};

export type SpinSettings = {
  hand: ClockHand | null;
  radius: SpinRadius;
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

// Engine-agnostic clock manager interface
export interface LayerClockManager {
  init(app: GenericApplication, built: BuiltLayer[]): void;
  tick(): void;
  recompute(): void;
  dispose(): void;
  getItems(): ClockItem[];
}

// Engine-agnostic utility functions
export function getSpriteDimensions(sp: GenericSprite): { width: number; height: number } | null {
  // Try to get dimensions from texture (Pixi) or element (DOM)
  const spriteAny = sp as any;
  let width: number;
  let height: number;

  // Pixi.js sprite with texture
  if (spriteAny.texture) {
    const tex = spriteAny.texture;
    width = tex.orig?.width ?? tex.width ?? spriteAny.width;
    height = tex.orig?.height ?? tex.height ?? spriteAny.height;
  }
  // DOM element
  else if (spriteAny.naturalWidth !== undefined) {
    width = spriteAny.naturalWidth || spriteAny.width;
    height = spriteAny.naturalHeight || spriteAny.height;
  }
  // Fallback to generic width/height
  else {
    width = spriteAny.width || 0;
    height = spriteAny.height || 0;
  }

  if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

export function pointOnRect(width: number, height: number, angleRad: number): Vec2 {
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

export function rotateVec(v: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: v.x * c - v.y * s,
    y: v.x * s + v.y * c,
  };
}

export function computeClockGeometry(
  sprite: GenericSprite,
  clock: ClockConfig,
  layerId: string,
): ClockGeometry | null {
  const dims = getSpriteDimensions(sprite);
  if (!dims) {
    warnClock(layerId, "missing texture dimensions");
    return null;
  }

  const baseAngle = toRad(clock.base?.angleDeg ?? 0);
  const tipAngle = toRad(clock.tip?.angleDeg ?? 0);
  const baseLocal = pointOnRect(dims.width, dims.height, baseAngle);
  const tipLocal = pointOnRect(dims.width, dims.height, tipAngle);
  const baseTipVec = { x: tipLocal.x - baseLocal.x, y: tipLocal.y - baseLocal.y };
  const baseTipLength = Math.hypot(baseTipVec.x, baseTipVec.y);

  if (!isFinite(baseTipLength) || baseTipLength <= 1e-3) {
    warnClock(layerId, "invalid base/tip configuration");
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

export function resolveTimeSource(clock: ClockConfig): TimeSource {
  const tz = clock.timezone ?? "device";
  const offset = clock.source?.tzOffsetMinutes ?? null;
  if (tz === "utc") return { mode: "utc", tzOffsetMinutes: offset };
  if (tz === "server") return { mode: "server", tzOffsetMinutes: offset };
  return { mode: "device", tzOffsetMinutes: offset };
}

export function getTimeParts(src: TimeSource) {
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

export function timeAngleRad(
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

export function clampCenter(
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

export function pctToStage(center: { xPct: number; yPct: number }): Vec2 {
  return {
    x: (center.xPct / 100) * STAGE_WIDTH,
    y: (center.yPct / 100) * STAGE_HEIGHT,
  };
}

export function resolveSpinRadius(clock: ClockConfig): SpinRadius {
  const rawValue = clock.spinRadius?.value;
  const value = typeof rawValue === "number" && isFinite(rawValue) ? Math.max(0, rawValue) : null;
  const rawPct = clock.spinRadius?.pct;
  const pct = typeof rawPct === "number" && isFinite(rawPct) ? Math.max(0, rawPct) / 100 : null;
  return { value, pct };
}

export function resolveSpinRadiusPx(item: ClockItem, maxScale: number): number {
  if (item.spin.radius.value != null) return item.spin.radius.value;
  if (item.spin.radius.pct != null && item.geometry) {
    return item.spin.radius.pct * item.geometry.baseTipLength * maxScale;
  }
  return 0;
}

// Clock item management
function createClockItem(b: BuiltLayer): ClockItem | null {
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
      warnClock(b.cfg.id, "orbitHand set but radius is zero; disabling orbit");
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

  debugClock(b.cfg.id, "resolved", {
    centerPct,
    spinHand,
    orbitHand,
    orbitRadius: orbit?.radius ?? null,
  });

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
}

function recomputeItem(item: ClockItem) {
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
      if (item.orbit.hand) warnClock(item.cfg.id, "orbit radius collapsed; disabling orbit");
      item.orbit.phase = radius > 1e-3 ? Math.atan2(dy, dx) : 0;
      if (radius <= 1e-3) item.orbit.hand = null;
    }
  }

  const geom = computeClockGeometry(item.sprite, item.clock, item.cfg.id);
  if (geom) item.geometry = geom;

  // Update spin settings
  item.spin.radius = resolveSpinRadius(item.clock);
}

function tickClock(items: ClockItem[]) {
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
}

// Create unified clock manager
export function createLayerClockManager(): LayerClockManager {
  const items: ClockItem[] = [];
  let _app: Application | null = null;

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

// Export convenience functions
export function createClockManager(): LayerClockManager {
  return createLayerClockManager();
}

// Legacy compatibility function for existing buildClock usage
export function buildClock(app: Application, built: BuiltLayer[]) {
  const manager = createLayerClockManager();
  manager.init(app, built);

  return {
    items: manager.getItems(),
    tick: () => manager.tick(),
    recompute: () => manager.recompute(),
  };
}
