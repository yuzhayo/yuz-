/**
 * LayerContracts.ts
 * 
 * ⚠️  AI AGENT WARNING: This file contains CRITICAL type contracts!
 * ❌ DO NOT DELETE - Required by all layer processing modules
 * ✅ Safe to modify interfaces if extending functionality
 */

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