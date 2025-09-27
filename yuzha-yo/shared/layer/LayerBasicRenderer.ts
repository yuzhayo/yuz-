/**
 * Basic Layer System - Three.js Renderer
 * 
 * Three.js rendering logic adapted from rawcode LogicRendererPixi.ts
 * for use with the Three.js-based layer system.
 */

import * as THREE from 'three'
import type { LayerConfig } from './LayerBasicTypes'
import { processLayerTransform, applyTransformToMesh } from './LayerBasicTransform'

export interface RenderedLayer {
  id: string
  mesh: THREE.Mesh
  cfg: LayerConfig
}

export interface RendererOptions {
  scene: THREE.Scene
  backgroundAlpha?: number
  antialias?: boolean
}

export class LayerBasicRenderer {
  private scene: THREE.Scene
  private layers: RenderedLayer[] = []
  
  constructor(options: RendererOptions) {
    this.scene = options.scene
  }

  createMeshFromTexture(texture: THREE.Texture, cfg: LayerConfig): THREE.Mesh {
    // Create plane geometry sized to match texture aspect ratio
    const aspect = texture.image ? texture.image.width / texture.image.height : 1
    const width = 100 // Base size in world units
    const height = width / aspect
    
    const geometry = new THREE.PlaneGeometry(width, height)
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      transparent: true,
      alphaTest: 0.001
    })
    
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = cfg.id
    
    // Apply transform data
    const transform = processLayerTransform(cfg)
    applyTransformToMesh(mesh, transform)
    
    return mesh
  }

  addLayer(texture: THREE.Texture, cfg: LayerConfig): RenderedLayer {
    const mesh = this.createMeshFromTexture(texture, cfg)
    this.scene.add(mesh)
    
    const layer: RenderedLayer = {
      id: cfg.id,
      mesh,
      cfg
    }
    
    this.layers.push(layer)
    return layer
  }

  removeLayer(id: string): boolean {
    const index = this.layers.findIndex(layer => layer.id === id)
    if (index === -1) return false
    
    const layer = this.layers[index]
    this.scene.remove(layer.mesh)
    layer.mesh.geometry.dispose()
    if (layer.mesh.material instanceof THREE.Material) {
      layer.mesh.material.dispose()
    }
    
    this.layers.splice(index, 1)
    return true
  }

  updateLayerTransform(id: string, cfg: LayerConfig): boolean {
    const layer = this.layers.find(l => l.id === id)
    if (!layer) return false
    
    layer.cfg = cfg
    const transform = processLayerTransform(cfg)
    applyTransformToMesh(layer.mesh, transform)
    return true
  }

  dispose(): void {
    for (const layer of this.layers) {
      this.scene.remove(layer.mesh)
      layer.mesh.geometry.dispose()
      if (layer.mesh.material instanceof THREE.Material) {
        layer.mesh.material.dispose()
      }
    }
    this.layers.length = 0
  }

  getLayers(): RenderedLayer[] {
    return [...this.layers]
  }
}