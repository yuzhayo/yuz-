/**
 * Basic Layer System - Transform Processor
 * 
 * Transform calculations adapted from rawcode LogicLoaderBasic.ts
 * for use with the Three.js-based layer system.
 */

import * as THREE from 'three'
import type { LayerConfig } from './LayerBasicTypes'
import { toRad, percentToWorldCoords, percentToScale, layerToThreeCoords } from './LayerBasicMath'

// Transform logic from LogicLoaderBasic.ts lines 8-24
export function logicZIndexFor(cfg: LayerConfig): number {
  const m = cfg.id.match(/\d+/)
  return m ? parseInt(m[0], 10) : 0
}

export interface TransformData {
  position: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  zIndex: number
}

export function processLayerTransform(cfg: LayerConfig): TransformData {
  // Convert percentage positions to world coordinates
  const worldCoords = percentToWorldCoords(cfg.position.xPct ?? 0, cfg.position.yPct ?? 0)
  
  // Convert to Three.js coordinate system
  const threeCoords = layerToThreeCoords(worldCoords.x, worldCoords.y)
  
  // Apply scale transform
  const scale = percentToScale(cfg.scale?.pct ?? 100)
  
  // Apply rotation transform
  const rotation = toRad(cfg.angleDeg ?? 0)
  
  // Get z-index for layering
  const zIndex = logicZIndexFor(cfg)
  
  return {
    position: { x: threeCoords.x, y: threeCoords.y, z: zIndex * 0.01 }, // Convert zIndex to small z offset
    scale: { x: scale, y: scale, z: 1 },
    rotation: { x: 0, y: 0, z: rotation },
    zIndex
  }
}

export function applyTransformToMesh(mesh: THREE.Mesh, transform: TransformData): void {
  mesh.position.set(transform.position.x, transform.position.y, transform.position.z)
  mesh.scale.set(transform.scale.x, transform.scale.y, transform.scale.z)
  mesh.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z)
}