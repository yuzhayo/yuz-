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
import { Application, Assets, Container, Sprite } from "pixi.js";
import { createLayerSpinManager } from "./LayerSpin";
import type { LayerSpinManager } from "./LayerSpin";
import { createLayerClockManager } from "./LayerClock";
import type { LayerClockManager, ClockConfig } from "./LayerClock";
import { createLayerOrbitManager } from "./LayerOrbit";
import type { LayerOrbitManager } from "./LayerOrbit";
import { createLayerEffectManager } from "./LayerEffect";
import type { LayerEffectManager, EffectHandler, GlowSpec, BloomSpec, AdvancedEffectSpec, LayerEffectConfig } from "./LayerEffect";

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

// === TYPE GUARDS AND SPRITE INTERFACES ===

// Enhanced sprite interface with optional Pixi-specific properties
export interface PixiSprite extends GenericSprite {
  anchor?: {
    set?: (x: number, y?: number) => void;
  };
  texture?: {
    width?: number;
    height?: number;
    orig?: { width?: number; height?: number };
  };
  width?: number;
  height?: number;
}

// Enhanced container interface with optional Pixi-specific properties
export interface PixiContainer extends GenericContainer {
  sortableChildren?: boolean;
  destroy?: (options?: { children?: boolean }) => void;
  _cleanup?: () => void;
}

// Type guards for safe property access
export function hasAnchor(sprite: GenericSprite): sprite is PixiSprite {
  return typeof (sprite as PixiSprite).anchor?.set === 'function';
}

export function hasTexture(sprite: GenericSprite): sprite is PixiSprite {
  return 'texture' in sprite && typeof (sprite as PixiSprite).texture === 'object';
}

export function hasScaleSet(sprite: GenericSprite): sprite is GenericSprite & { scale: { set: (x: number, y: number) => void } } {
  return typeof sprite.scale === 'object' && 'set' in sprite.scale && typeof sprite.scale.set === 'function';
}

export function hasTicker(app: GenericApplication): app is GenericApplication & { ticker: NonNullable<GenericApplication['ticker']> } {
  return app.ticker !== undefined && app.ticker !== null;
}

export function hasPixiTicker(app: GenericApplication): boolean {
  return hasTicker(app) && typeof app.ticker.add === 'function' && typeof app.ticker.remove === 'function';
}

export function hasSortableChildren(container: GenericContainer): container is PixiContainer {
  return 'sortableChildren' in container;
}

export function hasCleanup(container: GenericContainer): container is PixiContainer {
  return '_cleanup' in container && typeof (container as PixiContainer)._cleanup === 'function';
}

export function hasDestroy(obj: unknown): obj is { destroy: (options?: unknown) => void } {
  return typeof obj === 'object' && obj !== null && 'destroy' in obj && typeof (obj as any).destroy === 'function';
}

// Safe global property access
export function isDevelopmentMode(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean((window as { __DEV__?: boolean }).__DEV__);
  } catch {
    return false;
  }
}

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

// Type guards for better application type checking
type PixiLikeTicker = {
  deltaMS?: number;
  add?: (fn: () => void) => void;
  remove?: (fn: () => void) => void;
};

type PixiLikeRenderer = {
  type?: string | number;
  gl?: WebGLRenderingContext | WebGL2RenderingContext | null;
};

type PixiLikeApplication = {
  ticker?: PixiLikeTicker;
  renderer?: PixiLikeRenderer;
  view?: HTMLCanvasElement;
  stage?: { addChild?: (child: unknown) => void; removeChild?: (child: unknown) => void };
  destroy?: (options?: unknown) => void;
};

export interface GenericApplication {
  ticker?: PixiLikeTicker;
  renderer?: PixiLikeRenderer;
  view?: HTMLCanvasElement | unknown; // Allow for different canvas types
  stage?: { addChild?: (child: unknown) => unknown; removeChild?: (child: unknown) => void };
  destroy?: (options?: unknown) => void;
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
  clock?: ClockConfig | null;
  effects?: LayerEffectConfig | null;
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

// Error result type for consistent error handling
export type LayerModuleResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
};

// Performance configuration for optimization
export interface LayerModulePerformance {
  enableOptimizations?: boolean;
  enableEarlyReturns?: boolean;
  maxProcessingTimeMs?: number;
  debugMode?: boolean;
}

// Initialization configuration for managers
export interface LayerModuleInitConfig {
  app: GenericApplication;
  layers: BuiltLayer[];
  performance?: LayerModulePerformance;
  dependencies?: Record<string, unknown>;
}

// Base interface all managers must implement for consistency
export interface LayerModule {
  // Core lifecycle methods - consistent across all managers
  init(config: LayerModuleInitConfig): LayerModuleResult;
  tick(elapsed: number): LayerModuleResult;
  recompute(): LayerModuleResult;
  dispose(): LayerModuleResult;
  
  // Metadata and status
  readonly name: string;
  readonly version: string;
  readonly isRequired: boolean; // true = critical, false = optional
  readonly hasActiveItems: boolean;
  
  // Performance and diagnostics
  getPerformanceStats?(): Record<string, number>;
  validateConfiguration?(): LayerModuleResult<boolean>;
  
  // Manager-specific data access (standardized return type)
  getItems(): readonly unknown[]; // Each manager defines its own item type, but returns should be readonly
}

// Enhanced manager interface for standardized layer managers
export interface StandardLayerManager extends LayerModule {
  // Standard manager methods with consistent signatures
  init(config: LayerModuleInitConfig): LayerModuleResult;
  tick(elapsed: number): LayerModuleResult;
  recompute(): LayerModuleResult;
  dispose(): LayerModuleResult;
  
  // Error handling and validation
  validateConfiguration(): LayerModuleResult<boolean>;
  
  // Performance optimization
  getPerformanceStats(): Record<string, number>;
  
  // Manager state
  readonly itemCount: number;
  readonly isInitialized: boolean;
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
// 🟢 BLOCK 1.5: UNIFIED UTILITY FUNCTIONS & PERFORMANCE OPTIMIZATIONS
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete (math helpers only, no visual impact)
// Consolidated utility functions from all Layer modules to eliminate duplication
// + Performance caches, throttling, and optimization mechanisms
// ===================================================================

// === ANGLE CONVERSION UTILITIES ===

/**
 * Convert degrees to radians
 */
export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Normalize degrees to 0-360 range
 */
export function normDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

// === CLAMPING AND VALIDATION UTILITIES ===

/**
 * Clamp a number between min and max values
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Clamp a number between 0 and 1
 */
export function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

/**
 * Clamp RPM values to valid range (0-60 RPM)
 * Handles various input types safely
 */
export function clampRpm60(v: unknown): number {
  const n = typeof v === "number" ? v : v == null ? 0 : Number(v);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.min(60, Math.max(0, n));
}

// === SAFE CONVERSION UTILITIES ===

/**
 * Safely convert value to number with fallback
 */
export function safeNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === "number" && isFinite(value)) return value;
  if (value == null) return fallback;
  const converted = Number(value);
  return isFinite(converted) ? converted : fallback;
}

/**
 * Safely get percentage value (0-100) with fallback
 */
export function safePct(value: unknown, fallback: number = 0): number {
  return clamp(safeNumber(value, fallback), 0, 100);
}

// === ERROR HANDLING AND LOGGING UTILITIES ===

/**
 * Debug logging utility - only logs in development
 */
export function debug(context: string, message: string, ...args: unknown[]): void {
  if (isDevelopmentMode()) {
    console.log(`[${context}] ${message}`, ...args);
  }
}

/**
 * Warning logging utility - always logs warnings
 */
export function warn(context: string, message: string, ...args: unknown[]): void {
  console.warn(`[${context}] ${message}`, ...args);
}

/**
 * Error logging utility - always logs errors
 */
export function error(context: string, message: string, ...args: unknown[]): void {
  console.error(`[${context}] ${message}`, ...args);
}

// === NULL SAFETY UTILITIES ===

/**
 * Check if value is valid number (not null, undefined, NaN, or Infinity)
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && isFinite(value);
}

/**
 * Check if value is valid non-empty string
 */
export function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Safe object property access with type checking
 */
export function safeGet<T>(obj: any, key: string, validator: (val: unknown) => val is T, fallback: T): T {
  if (obj && typeof obj === "object" && key in obj) {
    const value = obj[key];
    if (validator(value)) return value;
  }
  return fallback;
}

// === GEOMETRY UTILITIES ===

/**
 * Ensure value is within bounds with wraparound for angles
 */
export function wrapAngle(angleDeg: number): number {
  return normDeg(angleDeg);
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

/**
 * Check if two numbers are approximately equal within tolerance
 */
export function approximately(a: number, b: number, tolerance: number = 1e-6): boolean {
  return Math.abs(a - b) <= tolerance;
}

// ===================================================================
// 🚀 PERFORMANCE OPTIMIZATION UTILITIES
// ⚠️  AI AGENT: PERFORMANCE BLOCK - Critical for performance
// Caching, throttling, and optimization mechanisms
// ===================================================================

// === CACHING MECHANISMS ===

// Cache for expensive transform calculations
const _transformCache = new Map<string, { width: number; height: number; transform: StageTransform; timestamp: number }>();
const TRANSFORM_CACHE_TTL = 100; // 100ms cache TTL

// Cache for geometry computations
const _geometryCache = new Map<string, { result: any; timestamp: number }>();
const GEOMETRY_CACHE_TTL = 500; // 500ms cache TTL

// Cache for configuration parsing
const _configCache = new WeakMap<object, { result: any; timestamp: number }>();

// Cache for asset loading promises
const _assetCache = new Map<string, Promise<any>>();

/**
 * Cached transform calculation with TTL invalidation
 */
export function getCachedTransform(width: number, height: number): StageTransform {
  const key = `${width}:${height}`;
  const cached = _transformCache.get(key);
  const now = performance.now();
  
  if (cached && (now - cached.timestamp) < TRANSFORM_CACHE_TTL) {
    return cached.transform;
  }
  
  try {
    const transform = calculateStageTransform(width, height);
    _transformCache.set(key, { width, height, transform, timestamp: now });
    
    // Cleanup old cache entries
    if (_transformCache.size > 50) {
      for (const [k, v] of _transformCache) {
        if ((now - v.timestamp) > TRANSFORM_CACHE_TTL * 5) {
          _transformCache.delete(k);
        }
      }
    }
    
    return transform;
  } catch (e) {
    error("LayerCreator", `Transform calculation failed: ${e}`);
    return { scale: 1, offsetX: 0, offsetY: 0, containerWidth: width, containerHeight: height };
  }
}

/**
 * Cached geometry computation with TTL invalidation
 */
export function getCachedGeometry<T>(key: string, computeFn: () => T, ttl: number = GEOMETRY_CACHE_TTL): T {
  const cached = _geometryCache.get(key);
  const now = performance.now();
  
  if (cached && (now - cached.timestamp) < ttl) {
    return cached.result;
  }
  
  try {
    const result = computeFn();
    _geometryCache.set(key, { result, timestamp: now });
    
    // Cleanup old cache entries
    if (_geometryCache.size > 100) {
      for (const [k, v] of _geometryCache) {
        if ((now - v.timestamp) > ttl * 3) {
          _geometryCache.delete(k);
        }
      }
    }
    
    return result;
  } catch (e) {
    error("LayerCreator", `Geometry computation failed for key ${key}: ${e}`);
    throw e;
  }
}

/**
 * Cached configuration parsing
 */
export function getCachedConfig<T>(config: object, parseFn: (config: object) => T): T {
  const cached = _configCache.get(config);
  const now = performance.now();
  
  if (cached && (now - cached.timestamp) < 1000) { // 1s cache for config
    return cached.result;
  }
  
  try {
    const result = parseFn(config);
    _configCache.set(config, { result, timestamp: now });
    return result;
  } catch (e) {
    error("LayerCreator", `Config parsing failed: ${e}`);
    throw e;
  }
}

/**
 * Cached asset loading with promise reuse
 */
export function getCachedAsset(url: string, loadFn: (url: string) => Promise<any>): Promise<any> {
  let cached = _assetCache.get(url);
  
  if (!cached) {
    cached = loadFn(url).catch(e => {
      // Remove failed promises from cache so they can be retried
      _assetCache.delete(url);
      throw e;
    });
    _assetCache.set(url, cached);
  }
  
  return cached;
}

// === THROTTLING AND DEBOUNCING ===

const _throttledFunctions = new Map<string, { fn: Function; lastCall: number; timeout?: number }>();
const _debouncedFunctions = new Map<string, { fn: Function; timeout: number }>();

/**
 * Throttle function execution using requestAnimationFrame
 */
export function throttleRAF<T extends (...args: any[]) => any>(key: string, fn: T): T {
  return ((...args: any[]) => {
    const entry = _throttledFunctions.get(key);
    const now = performance.now();
    
    if (!entry || (now - entry.lastCall) >= 16.67) { // ~60fps
      if (entry?.timeout) {
        cancelAnimationFrame(entry.timeout);
      }
      
      const timeout = requestAnimationFrame(() => {
        _throttledFunctions.set(key, { fn, lastCall: performance.now() });
        try {
          fn(...args);
        } catch (e) {
          error("LayerCreator", `Throttled function ${key} failed: ${e}`);
        }
      });
      
      _throttledFunctions.set(key, { fn, lastCall: now, timeout });
    }
  }) as T;
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: any[]) => any>(key: string, fn: T, delay: number = 250): T {
  return ((...args: any[]) => {
    const entry = _debouncedFunctions.get(key);
    
    if (entry) {
      clearTimeout(entry.timeout);
    }
    
    const timeout = setTimeout(() => {
      _debouncedFunctions.delete(key);
      try {
        fn(...args);
      } catch (e) {
        error("LayerCreator", `Debounced function ${key} failed: ${e}`);
      }
    }, delay);
    
    _debouncedFunctions.set(key, { fn, timeout });
  }) as T;
}

// === RESOURCE MANAGEMENT ===

/**
 * Resource pool for frequently created objects
 */
class ResourcePool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn?: (item: T) => void;
  private maxSize: number;
  
  constructor(createFn: () => T, resetFn?: (item: T) => void, maxSize: number = 50) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }
  
  acquire(): T {
    const item = this.pool.pop();
    if (item) {
      return item;
    }
    
    try {
      return this.createFn();
    } catch (e) {
      error("LayerCreator", `Resource pool creation failed: ${e}`);
      throw e;
    }
  }
  
  release(item: T): void {
    if (this.pool.length < this.maxSize) {
      try {
        this.resetFn?.(item);
        this.pool.push(item);
      } catch (e) {
        warn("LayerCreator", `Resource pool reset failed: ${e}`);
      }
    }
  }
  
  clear(): void {
    this.pool.length = 0;
  }
  
  get size(): number {
    return this.pool.length;
  }
}

// Sprite pool for reusing sprite-like objects
export const spritePool = new ResourcePool(
  () => ({
    x: 0, y: 0, rotation: 0, alpha: 1,
    scale: { x: 1, y: 1, set: function(x: number, y: number) { this.x = x; this.y = y; } },
    zIndex: 0
  }),
  (sprite: any) => {
    sprite.x = 0; sprite.y = 0; sprite.rotation = 0; sprite.alpha = 1;
    sprite.scale.x = 1; sprite.scale.y = 1; sprite.zIndex = 0;
  }
);

// === ENVIRONMENT DETECTION ===

/**
 * Detect current environment capabilities
 */
export function detectEnvironment() {
  const env = {
    isSSR: typeof window === 'undefined',
    isBrowser: typeof window !== 'undefined',
    hasWebGL: false,
    hasCanvas: false,
    hasRAF: typeof requestAnimationFrame !== 'undefined',
    deviceMemory: 4, // Default fallback
    hardwareConcurrency: 4, // Default fallback
    isReplit: false
  };
  
  if (env.isBrowser) {
    try {
      // WebGL detection
      const canvas = document.createElement('canvas');
      env.hasCanvas = !!canvas.getContext;
      env.hasWebGL = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      
      // Hardware capability detection
      const nav = navigator as any;
      env.deviceMemory = nav.deviceMemory || 4;
      env.hardwareConcurrency = nav.hardwareConcurrency || 4;
      
      // Replit environment detection (based on common Replit characteristics)
      env.isReplit = !!(
        typeof window !== 'undefined' && (
          window.location.hostname.includes('replit.') ||
          window.location.hostname.includes('repl.it') ||
          (window as any).__REPLIT__ ||
          document.querySelector('meta[name="viewport"][content*="replit"]')
        )
      );
    } catch (e) {
      warn("LayerCreator", `Environment detection failed: ${e}`);
    }
  }
  
  return env;
}

// Cache environment detection result
let _environmentCache: ReturnType<typeof detectEnvironment> | null = null;
export function getEnvironment() {
  if (!_environmentCache) {
    _environmentCache = detectEnvironment();
  }
  return _environmentCache;
}

// === SAFE ASYNC OPERATIONS ===

/**
 * Execute async operation with timeout and error handling
 */
export async function safeAsyncOperation<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 5000,
  fallback?: T
): Promise<T> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    
    const result = await Promise.race([operation(), timeoutPromise]);
    return result;
  } catch (e) {
    error("LayerCreator", `Async operation failed: ${e}`);
    if (fallback !== undefined) {
      return fallback;
    }
    throw e;
  }
}

// === BOUNDS CHECKING UTILITIES ===

/**
 * Safe numeric operation with bounds checking
 */
export function safeNumericOp<T extends number>(
  value: unknown, 
  operation: (n: number) => T, 
  fallback: T,
  min?: number,
  max?: number
): T {
  try {
    const num = safeNumber(value, fallback);
    
    if (min !== undefined && num < min) return fallback;
    if (max !== undefined && num > max) return fallback;
    
    const result = operation(num);
    
    if (!isFinite(result)) return fallback;
    if (min !== undefined && result < min) return fallback;
    if (max !== undefined && result > max) return fallback;
    
    return result;
  } catch {
    return fallback;
  }
}

/**
 * Safe array access with bounds checking
 */
export function safeArrayAccess<T>(array: T[], index: number, fallback?: T): T | undefined {
  if (!Array.isArray(array) || index < 0 || index >= array.length) {
    return fallback;
  }
  return array[index];
}

/**
 * Safe object property access with validation
 */
export function safeObjectAccess<T>(
  obj: any, 
  path: string[], 
  validator?: (val: unknown) => val is T,
  fallback?: T
): T | undefined {
  if (!obj || typeof obj !== 'object') return fallback;
  
  let current = obj;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return fallback;
    }
    current = current[key];
  }
  
  if (validator && !validator(current)) {
    return fallback;
  }
  
  return current;
}

// === MEMORY MANAGEMENT ===

/**
 * Clean up caches and pooled resources
 */
export function cleanupCaches(): void {
  _transformCache.clear();
  _geometryCache.clear();
  spritePool.clear();
  
  // Clear throttled function timeouts
  for (const [key, entry] of _throttledFunctions) {
    if (entry.timeout) {
      cancelAnimationFrame(entry.timeout);
    }
  }
  _throttledFunctions.clear();
  
  // Clear debounced function timeouts
  for (const [key, entry] of _debouncedFunctions) {
    clearTimeout(entry.timeout);
  }
  _debouncedFunctions.clear();
  
  debug("LayerCreator", "Caches and pools cleaned up");
}

/**
 * Get memory usage statistics
 */
export function getMemoryStats() {
  return {
    transformCacheSize: _transformCache.size,
    geometryCacheSize: _geometryCache.size,
    assetCacheSize: _assetCache.size,
    spritePoolSize: spritePool.size,
    throttledFunctions: _throttledFunctions.size,
    debouncedFunctions: _debouncedFunctions.size
  };
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
// 🟢 BLOCK 3: STAGE TRANSFORM FUNCTIONS  
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete if not needed
// Stage coordinate transformations for responsive scaling
// ===================================================================

/**
 * Calculate stage transform for cover behavior
 * Fills viewport while maintaining aspect ratio
 */
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
// 🔴 BLOCK 4: CORE LAYER TRANSFORM FUNCTIONS
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// These functions handle basic layer positioning and z-ordering
// ===================================================================

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
  if (hasScaleSet(sp)) {
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

// ===================================================================
// 🔴 BLOCK 5: CONFIG PROCESSING
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Handles JSON config reading and image URL resolution
// ===================================================================

function getUrlForImageRef(cfg: LogicConfig, ref: LayerConfig["imageRef"]): string | null {
  if (ref.kind === "url") return ref.url;
  const url = cfg.imageRegistry[ref.id];
  return url ?? null;
}

// ===================================================================
// 🟡 BLOCK 6: STAGE2048 TRANSFORM MANAGEMENT
// ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes stage transform)
// Handles DOM manipulation and coordinate transformation for stage scaling
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

// ===================================================================
// 🟡 BLOCK 8: ANIMATION MANAGERS STATE
// ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes animations)
// Manages spin, orbit, clock, and effect animations
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

// ===================================================================
// 🔴 BLOCK 10: CORE LAYER CREATOR IMPLEMENTATION
// ⚠️  AI AGENT: CRITICAL BLOCK - DO NOT DELETE
// Main implementation that creates and manages layers
// ===================================================================

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
      if (_container && hasSortableChildren(_container)) {
        _container.sortableChildren = true;
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
          if (hasAnchor(sprite) && sprite.anchor?.set) {
            sprite.anchor.set(0.5);
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

      // ===================================================================
      // 🟡 BLOCK 11: ANIMATION MANAGERS INITIALIZATION
      // ⚠️  AI AGENT: OPTIONAL BLOCK - Safe to delete (removes animations)
      // ===================================================================

      // Initialize all managers
      const spinManager = createLayerSpinManager();
      spinManager.init({ app, layers: built });

      const clockManager = createLayerClockManager();
      clockManager.init({ app, layers: built });

      // Build RPM map for orbit system compatibility
      const spinRpmBySprite = new Map<GenericSprite, number>();
      for (const b of built) {
        spinRpmBySprite.set(b.sprite, spinManager.getSpinRpm(b.sprite));
      }

      const orbitManager = createLayerOrbitManager();
      orbitManager.init({ app, layers: built, dependencies: { spinRpmBySprite } });

      // Effects (unified system)
      const effectManager = createLayerEffectManager(effectHandler);
      effectManager.init({ app, layers: built });

      // Create managers state
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
          _managersState.orbitManager?.recompute();
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

        const dt = (hasTicker(app) ? app.ticker.deltaMS || 16.667 : 16.667) / 1000;
        _managersState.elapsed += dt;

        // Basic Spin (handles only basic RPM-based spins)
        _managersState.spinManager?.tick(_managersState.elapsed);
        // Orbit
        _managersState.orbitManager?.tick(_managersState.elapsed);
        // Clock (handles clock-driven spins and orbital motion)
        _managersState.clockManager?.tick(_managersState.elapsed);
        // Effects (unified system)
        _managersState.effectManager?.tick(_managersState.elapsed);
      };

      _tickFunction = tick;
      if (_managersState) {
        _managersState.tickFunction = _tickFunction;
      }

      // Add ticker if we have animations
      try {
        if (manager.hasAnimations() && hasPixiTicker(app)) {
          app.ticker!.add!(_tickFunction);
        }
      } catch (e) {
        console.error("[LayerCreator] Error adding ticker:", e);
      }

      // Set up cleanup on container
      const prevCleanup = hasCleanup(_container) ? _container._cleanup : undefined;
      if (_container && 'sortableChildren' in _container) {
        (_container as PixiContainer)._cleanup = () => {
          manager.dispose();
          try {
            prevCleanup?.();
          } catch {}
        };
      }

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
        _managersState.orbitManager?.recompute();
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

  // Ensure we have a Pixi Application constructor
  if (!PixiApplication) {
    try {
      // Try to import Pixi.js dynamically
      const pixi = await import("pixi.js");
      PixiApplication = pixi.Application;
    } catch {
      throw new Error(
        "Pixi.js Application not available. Please provide PixiApplication parameter or install pixi.js",
      );
    }
  }

  // Create transform manager
  const transformManager = new StageTransformManager(options.debug);

  // Create Pixi application with FIXED dimensions
  const dpr = Math.min(options.dprCap ?? 2, window.devicePixelRatio || 1);

  // Create Pixi application with forced renderer type to avoid auto-detection
  let app: any;
  
  // Use simple Pixi application with forced canvas renderer for Replit compatibility
  try {
    console.log("Creating Pixi application with forceCanvas for Replit environment");
    app = new PixiApplication({
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      backgroundAlpha: options.backgroundAlpha ?? 0.1,
      antialias: options.antialias ?? false,
      autoDensity: false,
      resolution: 1,
      hello: false,
      forceCanvas: true, // This should force canvas renderer in Pixi 7
    });
  } catch (error) {
    console.log("forceCanvas failed, trying without renderer specification:", error);
    // Try without any renderer preference - let Pixi decide what works
    try {
      app = new PixiApplication({
        width: STAGE_WIDTH,
        height: STAGE_HEIGHT,
        backgroundAlpha: 0.1,
        hello: false,
      });
    } catch (fallbackError) {
      console.error("All Pixi configurations failed:", fallbackError);
      // Create a basic HTML5 Canvas fallback for display
      const canvas = document.createElement('canvas');
      canvas.width = STAGE_WIDTH;
      canvas.height = STAGE_HEIGHT;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.background = 'rgba(0,0,0,0.1)';
      
      // Create a mock Pixi app object for compatibility
      app = {
        view: canvas,
        stage: { addChild: () => {}, removeChild: () => {} },
        renderer: { render: () => {} },
        ticker: { add: () => {}, remove: () => {} },
        destroy: () => {},
      };
      console.log("Using fallback HTML5 Canvas for display");
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
 * Create just the transform manager (for custom Pixi setups)
 */
export function createTransformManager(debug = false): StageTransformManager {
  return new StageTransformManager(debug);
}

/**
 * Create just the Pixi application with correct dimensions
 */
export function createPixiApplication(options: Stage2048Options = {}, PixiApplication?: any) {
  if (!PixiApplication) {
    throw new Error("PixiApplication constructor required");
  }

  const dpr = Math.min(options.dprCap ?? 2, window.devicePixelRatio || 1);

  return new PixiApplication({
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    backgroundAlpha: options.backgroundAlpha ?? 0,
    antialias: options.antialias ?? true,
    autoDensity: true,
    resolution: dpr,
    preference: "webgl",
  });
}

// === REACT INTEGRATION ===

/**
 * Create a coordinate transformer hook for React components
 */
export function createCoordinateTransformer(manager: StageTransformManager) {
  return {
    /**
     * Transform pointer event coordinates to stage coordinates
     */
    transformPointerEvent: (event: ReactPointerEvent<HTMLElement>): StageCoordinates | null => {
      return manager.transformEventCoordinates(event.nativeEvent);
    },

    /**
     * Transform mouse event coordinates to stage coordinates
     */
    transformMouseEvent: (event: ReactMouseEvent<HTMLElement>): StageCoordinates | null => {
      return manager.transformEventCoordinates(event.nativeEvent);
    },

    /**
     * Transform touch event coordinates to stage coordinates
     */
    transformTouchEvent: (event: ReactTouchEvent<HTMLElement>): StageCoordinates | null => {
      return manager.transformEventCoordinates(event.nativeEvent);
    },
  };
}

/**
 * Hook for using coordinate transformation in gesture components
 */
export function useStageCoordinates(transformManager: StageTransformManager) {
  return {
    /**
     * Transform React pointer event to stage coordinates
     */
    transformPointerEvent: (event: ReactPointerEvent<HTMLElement>) => {
      return transformManager.transformEventCoordinates(event.nativeEvent);
    },

    /**
     * Get current stage transform data
     */
    getTransform: () => transformManager.getTransform(),

    /**
     * Check if stage coordinates are within bounds
     */
    isWithinStage: (stageX: number, stageY: number) => {
      return stageX >= 0 && stageX <= STAGE_WIDTH && stageY >= 0 && stageY <= STAGE_HEIGHT;
    },
  };
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

// ===================================================================
// 🟢 BLOCK 16: CONVENIENCE EXPORTS
// ⚠️  AI AGENT: UTILITY BLOCK - Safe to delete (convenience only)
// Export functions and default component for external use
// ===================================================================

export function createCreatorManager(): LayerCreatorManager {
  return createLayerCreatorManager();
}

export function createEngine(): PixiEngine {
  return createPixiEngine();
}

// Utility functions are now exported individually in BLOCK 1.5

// Export default for LogicStage
export default LogicStage;