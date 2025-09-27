/**
 * Basic Layer System - Mathematical Utilities
 * 
 * Mathematical helper functions adapted from rawcode LogicMath.ts
 * for use with the Three.js-based layer system.
 */

// ===========================================================================================
// SECTION 1: ANGLE CONVERSIONS
// ===========================================================================================

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function normDeg(deg: number): number {
  const d = deg % 360
  return d < 0 ? d + 360 : d
}

// ===========================================================================================
// SECTION 2: CLAMPING UTILITIES
// ===========================================================================================

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function clamp01(n: number): number {
  return clamp(n, 0, 1)
}

export function clampRpm60(v: unknown): number {
  const n = typeof v === 'number' ? v : v == null ? 0 : Number(v)
  if (!isFinite(n) || n <= 0) return 0
  return Math.min(60, Math.max(0, n))
}

// ===========================================================================================
// SECTION 3: COORDINATE SYSTEM UTILITIES
// ===========================================================================================

import { LAYER_CANVAS_WIDTH, LAYER_CANVAS_HEIGHT } from './LayerBasicTypes'

/**
 * Convert percentage-based position to world coordinates
 * Matches the 2048x2048 coordinate system from stages1
 */
export function percentToWorldCoords(xPct: number, yPct: number): { x: number; y: number } {
  const x = (xPct / 100) * LAYER_CANVAS_WIDTH
  const y = (yPct / 100) * LAYER_CANVAS_HEIGHT
  return { x, y }
}

/**
 * Convert world coordinates to percentage-based position
 */
export function worldCoordsToPercent(x: number, y: number): { xPct: number; yPct: number } {
  const xPct = (x / LAYER_CANVAS_WIDTH) * 100
  const yPct = (y / LAYER_CANVAS_HEIGHT) * 100
  return { xPct, yPct }
}

/**
 * Convert percentage scale to world scale factor
 */
export function percentToScale(pct: number): number {
  return pct / 100
}

// ===========================================================================================
// SECTION 4: THREE.JS COORDINATE SYSTEM ADAPTATION
// ===========================================================================================

/**
 * Convert from layer coordinate system to Three.js coordinate system
 * Three.js uses center-origin coordinates, layer system uses top-left origin
 */
export function layerToThreeCoords(x: number, y: number): { x: number; y: number } {
  // Convert from top-left (0,0) to center-origin
  const threeX = x - (LAYER_CANVAS_WIDTH / 2)
  const threeY = (LAYER_CANVAS_HEIGHT / 2) - y  // Flip Y axis for Three.js
  return { x: threeX, y: threeY }
}

/**
 * Convert from Three.js coordinate system to layer coordinate system
 */
export function threeToLayerCoords(x: number, y: number): { x: number; y: number } {
  // Convert from center-origin to top-left (0,0)
  const layerX = x + (LAYER_CANVAS_WIDTH / 2)
  const layerY = (LAYER_CANVAS_HEIGHT / 2) - y  // Flip Y axis back
  return { x: layerX, y: layerY }
}

// ===========================================================================================
// SECTION 5: INTERPOLATION AND EASING
// ===========================================================================================

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t)
}

/**
 * Smooth step interpolation (3t² - 2t³)
 */
export function smoothStep(t: number): number {
  t = clamp01(t)
  return t * t * (3 - 2 * t)
}

/**
 * Smoother step interpolation (6t⁵ - 15t⁴ + 10t³)
 */
export function smootherStep(t: number): number {
  t = clamp01(t)
  return t * t * t * (t * (t * 6 - 15) + 10)
}