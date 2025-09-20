import type {
  PointerEvent as ReactPointerEvent,
} from 'react';
/**
 * Pixi.js Stage Adapter
 * Integrates Stage Transform system with Pixi.js applications
 */

import { Application } from 'pixi.js'
import { StageTransformManager, STAGE_WIDTH, STAGE_HEIGHT } from './stage-transform'

export interface PixiStageAdapterOptions {
  /** Enable debug overlay */
  debug?: boolean
  /** Device pixel ratio cap */
  dprCap?: number
  /** Background alpha */
  backgroundAlpha?: number
  /** Enable antialiasing */
  antialias?: boolean
}

export class PixiStageAdapter {
  private app: Application | null = null
  private transformManager: StageTransformManager
  private container: HTMLElement | null = null
  
  constructor(private options: PixiStageAdapterOptions = {}) {
    this.transformManager = new StageTransformManager(options.debug)
  }

  /**
   * Create and mount Pixi application with fixed stage dimensions
   */
  async mount(rootElement: HTMLElement): Promise<{ app: Application; transformManager: StageTransformManager }> {
    // Create Pixi application with FIXED dimensions (no resizeTo)
    const dpr = Math.min(this.options.dprCap ?? 2, window.devicePixelRatio || 1)
    
    this.app = new Application({
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      backgroundAlpha: this.options.backgroundAlpha ?? 0,
      antialias: this.options.antialias ?? true,
      autoDensity: true,
      resolution: dpr
      // NOTE: No resizeTo - we manage sizing manually
    })

    // Create container and overlay structure
    this.container = document.createElement('div')
    const overlay = document.createElement('div')
    
    // Setup DOM structure
    rootElement.classList.add('stage-cover-root')
    rootElement.appendChild(this.container)
    this.container.appendChild(this.app.view as HTMLCanvasElement)
    this.container.appendChild(overlay)
    
    // Initialize transform system
    this.transformManager.initialize(
      this.container,
      this.app.view as HTMLCanvasElement,
      overlay
    )
    
    return {
      app: this.app,
      transformManager: this.transformManager
    }
  }

  /**
   * Get the overlay element for gesture handling
   */
  getOverlay(): HTMLElement | null {
    return this.container?.querySelector('.stage-cover-overlay') as HTMLElement || null
  }

  /**
   * Get the transform manager
   */
  getTransformManager(): StageTransformManager {
    return this.transformManager
  }

  /**
   * Get the Pixi application
   */
  getApp(): Application | null {
    return this.app
  }

  /**
   * Clean up and dispose resources
   */
  dispose() {
    if (this.app) {
      try {
        // Remove canvas from DOM
        const canvas = this.app.view as HTMLCanvasElement
        if (this.container && this.container.contains(canvas)) {
          this.container.removeChild(canvas)
        }
      } catch (e) {
        console.warn('Failed to remove canvas from DOM:', e)
      }

      // Destroy Pixi app
      this.app.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true
      })
      this.app = null
    }

    // Clean up container
    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container)
    }
    this.container = null

    // Dispose transform manager
    this.transformManager.dispose()
  }
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
      return transformManager.transformEventCoordinates(event.nativeEvent)
    },

    /**
     * Get current stage transform data
     */
    getTransform: () => transformManager.getTransform(),

    /**
     * Check if stage coordinates are within bounds
     */
    isWithinStage: (stageX: number, stageY: number) => {
      return stageX >= 0 && stageX <= STAGE_WIDTH && stageY >= 0 && stageY <= STAGE_HEIGHT
    }
  }
}


