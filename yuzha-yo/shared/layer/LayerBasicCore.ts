/**
 * Basic Layer System - Core Pipeline
 * 
 * Core orchestration pipeline adapted from rawcode logicLoader.ts (lines 31-143)
 * for use with the Three.js-based layer system.
 */

import * as THREE from 'three'
import type { LogicConfig, LayerConfig } from './LayerBasicTypes'
import { remapRegistry, getUrlForImageRef, loadTexture } from './LayerBasicAssets'
import { logicZIndexFor } from './LayerBasicTransform'
import { LayerBasicRenderer, type RenderedLayer } from './LayerBasicRenderer'

export interface BuildResult {
  layers: RenderedLayer[]
}

export class LayerBasicCore {
  private renderer: LayerBasicRenderer | null = null
  private config: LogicConfig | null = null
  private scene: THREE.Scene | null = null

  constructor() {}

  async loadFromConfig(configPath: string): Promise<void> {
    try {
      // Use Vite-compatible dynamic import instead of fetch for JSON
      // Note: configPath parameter is ignored in favor of static import for better TypeScript support
      const configModule = await import('./MainConfig.json')
      const rawConfig = (configModule as any).default as LogicConfig
      this.config = remapRegistry(rawConfig)
      
      console.log('[LayerBasicCore] Loaded config:', this.config)
    } catch (error) {
      console.error('[LayerBasicCore] Failed to load config:', error)
      throw error
    }
  }

  attachToThreeScene(scene: THREE.Scene): void {
    this.scene = scene
    this.renderer = new LayerBasicRenderer({ scene })
    
    if (this.config) {
      this.buildLayers().catch(error => {
        console.error('[LayerBasicCore] Failed to build layers:', error)
      })
    }
  }

  private async buildLayers(): Promise<BuildResult> {
    if (!this.config || !this.renderer) {
      throw new Error('LayerBasicCore not properly initialized')
    }

    // Sort layers by z-index then id fallback, to define render order
    const layers = [...this.config.layers].sort((a, b) => {
      const za = logicZIndexFor(a)
      const zb = logicZIndexFor(b)
      if (za !== zb) return za - zb
      return a.id.localeCompare(b.id)
    })

    const built: RenderedLayer[] = []
    let warnedZ = false

    // Prefetch assets in parallel to avoid sequential fetch latency
    const urlSet = new Set<string>()
    for (const layer of layers) {
      const url = getUrlForImageRef(this.config, layer.imageRef)
      if (url) urlSet.add(url)
    }

    try {
      await Promise.all(
        Array.from(urlSet).map((url) =>
          loadTexture(url).catch((e) => {
            console.warn('[LayerBasicCore] Preload failed for', url, e)
          })
        )
      )
    } catch {
      // Continue even if some preloads fail
    }

    for (const layer of layers) {
      // Warn once if legacy `z` is present and differs from ID-derived order
      const anyLayer = layer as unknown as { z?: number }
      if (!warnedZ && typeof anyLayer.z === 'number') {
        const derived = logicZIndexFor(layer)
        if (anyLayer.z !== derived) {
          console.warn('[LayerBasicCore] `z` is deprecated and ignored. Use numeric ID order. Layer:', layer.id,
            ' legacy z:', anyLayer.z, ' derived:', derived)
        } else {
          console.warn('[LayerBasicCore] `z` property is deprecated and ignored. Remove it from config. Layer:', layer.id)
        }
        warnedZ = true
      }

      const url = getUrlForImageRef(this.config, layer.imageRef)
      if (!url) {
        console.warn('[LayerBasicCore] Missing image URL for layer', layer.id, layer.imageRef)
        continue
      }

      try {
        // Texture should be cached from prefetch; load again if needed
        const texture = await loadTexture(url)
        const renderedLayer = this.renderer.addLayer(texture, layer)
        built.push(renderedLayer)
      } catch (e) {
        console.error('[LayerBasicCore] Failed to load', url, 'for layer', layer.id, e)
      }
    }

    return { layers: built }
  }

  dispose(): void {
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer = null
    }
    this.config = null
    this.scene = null
  }

  getConfig(): LogicConfig | null {
    return this.config
  }

  getLayers(): RenderedLayer[] {
    return this.renderer?.getLayers() || []
  }
}