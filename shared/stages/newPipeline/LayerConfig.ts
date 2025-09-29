/**
 * LayerConfig.ts - Configuration System for New Pipeline
 * 
 * This file provides a unified configuration system for the new pipeline implementation,
 * extracting and re-exporting all necessary types from the layer system files.
 */

// ===================================================================
// TYPE IMPORTS AND RE-EXPORTS
// ===================================================================

// Core schema types from LayerCreator.ts
export type ImageRegistry = Record<string, string>;
export type ImageRef = { kind: "urlId"; id: string } | { kind: "url"; url: string };

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

export type LogicConfig = {
  layersID: string[];
  imageRegistry: ImageRegistry;
  layers: LayerConfig[];
};

// Clock-related types from LayerClock.ts
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

export type Vec2 = { x: number; y: number };

export type TimeSource = {
  mode: "device" | "utc" | "server";
  tzOffsetMinutes?: number | null;
};

// Effect-related types from LayerEffect.ts
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

// Orbit-related types from LayerOrbit.ts
export type OrbitDirection = "cw" | "ccw";
export type OrbitOrientPolicy = "none" | "auto" | "override";

export type OrbitItem = {
  sprite: any; // Generic sprite interface
  cfg: LayerConfig;
  dir: 1 | -1;
  radPerSec: number;
  centerPct: { x: number; y: number };
  centerPx: { cx: number; cy: number };
  radius: number;
  basePhase: number;
  orientPolicy: OrbitOrientPolicy;
  orientDegRad: number;
  spinRpm: number;
};

// ===================================================================
// ASSET LOADING AND REMAPPING LOGIC
// ===================================================================

// Asset manifest for bundled assets using Vite's glob import
const assetManifest = import.meta.glob("../../asset/**/*.{png,jpg,jpeg,gif,webp,avif,svg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

// Asset path prefixes to detect shared assets
const SRC_ASSET_PREFIXES = ["/shared/asset/", "shared/asset/"];

/**
 * Resolves a bundled asset path to its actual URL
 * @param path - The asset path from the configuration
 * @returns The resolved asset URL or null if not found
 */
function resolveBundledAsset(path: string): string | null {
  for (const prefix of SRC_ASSET_PREFIXES) {
    if (path.startsWith(prefix)) {
      const relative = path.slice(prefix.length);
      const manifestKey = `../../asset/${relative}`;
      const mapped = assetManifest[manifestKey];
      if (mapped) return mapped;
      console.warn("[LayerConfig] Missing bundled asset for", path);
      return null;
    }
  }
  return null;
}

/**
 * Remaps asset references in the image registry to their bundled URLs
 * @param cfg - The raw configuration object
 * @returns Configuration with remapped asset URLs
 */
function remapRegistry(cfg: LogicConfig): LogicConfig {
  const registry = { ...cfg.imageRegistry };
  for (const [key, value] of Object.entries(registry)) {
    const mapped = resolveBundledAsset(value as string);
    if (mapped) registry[key] = mapped;
  }
  return { ...cfg, imageRegistry: registry };
}

// ===================================================================
// CONFIGURATION LOADER
// ===================================================================

// @ts-ignore - JSON import without type definition
import rawConfig from "./LayerConfig.json";

/**
 * Loads and processes the layer configuration with proper asset resolution
 * @returns The processed configuration with mapped asset URLs
 */
export function getLogicConfig(): LogicConfig {
  return remapRegistry(rawConfig as LogicConfig);
}

// Default export for backward compatibility
const config = getLogicConfig();
export default config;