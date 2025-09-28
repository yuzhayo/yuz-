/**
 * Stage2048 - Standalone 2048×2048 Stage System
 * 
 * A complete stage system that handles Pixi.js integration, coordinate transformation,
 * and responsive scaling with a fixed 2048×2048 design canvas.
 * 
 * Usage:
 * ```ts
 * import { createStage2048, STAGE_WIDTH, STAGE_HEIGHT } from '@shared/stages/Stage2048'
 * 
 * // Simple usage
 * const stage = await createStage2048(rootElement)
 * 
 * // Advanced usage with options
 * const stage = await createStage2048(rootElement, {
 *   debug: true,
 *   dprCap: 3,
 *   backgroundAlpha: 0.5
 * })
 * ```
 */

import type {
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from 'react';

// ===== CONSTANTS =====

/** Fixed stage dimensions - 2048×2048 design canvas */
export const STAGE_WIDTH = 2048
export const STAGE_HEIGHT = 2048

// ===== TYPES AND INTERFACES =====

export interface StageTransform {
  scale: number
  offsetX: number
  offsetY: number
  containerWidth: number
  containerHeight: number
}

export interface StageCoordinates {
  stageX: number
  stageY: number
}

export interface Stage2048Options {
  /** Enable debug overlay */
  debug?: boolean
  /** Device pixel ratio cap */
  dprCap?: number
  /** Background alpha for Pixi canvas */
  backgroundAlpha?: number
  /** Enable antialiasing */
  antialias?: boolean
  /** Inject CSS styles automatically */
  autoInjectCSS?: boolean
}

export interface Stage2048Instance {
  /** Pixi Application instance */
  app: any // Using any to avoid direct Pixi dependency
  /** Transform manager for coordinate conversion */
  transformManager: StageTransformManager
  /** Get the overlay element for gesture handling */
  getOverlay(): HTMLElement | null
  /** Get current transform data */
  getTransform(): StageTransform | null
  /** Transform event coordinates to stage coordinates */
  transformEventCoordinates(event: PointerEvent | MouseEvent | TouchEvent): StageCoordinates | null
  /** Clean up and dispose resources */
  dispose(): void
}

// ===== CSS STYLES =====

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
`.trim()

// ===== UTILITY FUNCTIONS =====

/**
 * Calculate stage transform for cover behavior
 * Fills viewport while maintaining aspect ratio
 */
export function calculateStageTransform(viewportWidth: number, viewportHeight: number): StageTransform {
  // Cover behavior: scale to fill viewport, crop what doesn't fit
  const scaleX = viewportWidth / STAGE_WIDTH
  const scaleY = viewportHeight / STAGE_HEIGHT
  const scale = Math.max(scaleX, scaleY) // Use larger scale for cover
  
  const scaledWidth = STAGE_WIDTH * scale
  const scaledHeight = STAGE_HEIGHT * scale
  
  // Center the scaled stage
  const offsetX = (viewportWidth - scaledWidth) / 2
  const offsetY = (viewportHeight - scaledHeight) / 2
  
  return {
    scale,
    offsetX,
    offsetY,
    containerWidth: scaledWidth,
    containerHeight: scaledHeight
  }
}

/**
 * Transform viewport coordinates to stage coordinates
 * Essential for making gestures work with scaled canvas
 */
export function transformCoordinatesToStage(
  clientX: number,
  clientY: number,
  transform: StageTransform
): StageCoordinates {
  // Convert from viewport coordinates to stage coordinates
  const stageX = (clientX - transform.offsetX) / transform.scale
  const stageY = (clientY - transform.offsetY) / transform.scale
  
  return { stageX, stageY }
}

/**
 * Check if coordinates are within the stage bounds
 */
export function isWithinStage(stageX: number, stageY: number): boolean {
  return stageX >= 0 && stageX <= STAGE_WIDTH && stageY >= 0 && stageY <= STAGE_HEIGHT
}

/**
 * Inject CSS styles into the document head
 * Only injects once, safe to call multiple times
 */
export function ensureStageStyles(): void {
  const styleId = 'stage2048-styles'
  
  // Check if styles are already injected
  if (document.getElementById(styleId)) {
    return
  }
  
  // Create and inject style element
  const styleElement = document.createElement('style')
  styleElement.id = styleId
  styleElement.textContent = STAGE_CSS
  document.head.appendChild(styleElement)
}

// ===== STAGE TRANSFORM MANAGER =====

/**
 * Stage transform manager class
 * Handles DOM manipulation and coordinate transformation
 */
export class StageTransformManager {
  private container: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private overlay: HTMLElement | null = null
  private transform: StageTransform | null = null
  private resizeObserver: ResizeObserver | null = null
  private debugElement: HTMLElement | null = null
  
  constructor(private debug = false) {
    // Initialize resize observer
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === document.body || entry.target === document.documentElement) {
          this.updateTransform()
        }
      }
    })
  }

  /**
   * Initialize the stage transform system
   */
  initialize(container: HTMLElement, canvas: HTMLCanvasElement, overlay?: HTMLElement) {
    this.container = container
    this.canvas = canvas
    this.overlay = overlay || null
    
    // Apply CSS classes
    container.classList.add('stage-cover-container')
    canvas.classList.add('stage-cover-canvas')
    if (overlay) {
      overlay.classList.add('stage-cover-overlay')
    }
    
    // Start observing resize events
    this.resizeObserver?.observe(document.body)
    
    // Setup debug if enabled
    if (this.debug) {
      this.setupDebug()
    }
    
    // Initial transform
    this.updateTransform()
    
    return this
  }

  /**
   * Update transform based on current viewport size
   */
  updateTransform() {
    if (!this.container || !this.canvas) return
    
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    this.transform = calculateStageTransform(viewportWidth, viewportHeight)
    
    // Apply CSS transforms
    this.canvas.style.transform = `scale(${this.transform.scale})`
    this.container.style.width = `${this.transform.containerWidth}px`
    this.container.style.height = `${this.transform.containerHeight}px`
    
    // Update debug info
    if (this.debug && this.debugElement) {
      this.updateDebugInfo()
    }
  }

  /**
   * Transform event coordinates to stage coordinates
   */
  transformEventCoordinates(event: PointerEvent | MouseEvent | TouchEvent): StageCoordinates | null {
    if (!this.transform) return null
    
    let clientX: number, clientY: number
    
    if ('touches' in event && event.touches.length > 0) {
      // Touch event
      const firstTouch = event.touches.item(0)
      if (!firstTouch) return null
      clientX = firstTouch.clientX
      clientY = firstTouch.clientY
    } else if ('clientX' in event) {
      // Mouse or pointer event
      clientX = event.clientX
      clientY = event.clientY
    } else {
      return null
    }
    
    return transformCoordinatesToStage(clientX, clientY, this.transform)
  }

  /**
   * Get current transform data
   */
  getTransform(): StageTransform | null {
    return this.transform
  }

  /**
   * Setup debug overlay
   */
  private setupDebug() {
    this.debugElement = document.createElement('div')
    this.debugElement.classList.add('stage-cover-debug')
    document.body.appendChild(this.debugElement)
    this.updateDebugInfo()
  }

  /**
   * Update debug information
   */
  private updateDebugInfo() {
    if (!this.debugElement || !this.transform) return
    
    const vw = window.innerWidth
    const vh = window.innerHeight
    const aspectRatio = (vw / vh).toFixed(2)
    
    this.debugElement.innerHTML = `
      Stage: ${STAGE_WIDTH}×${STAGE_HEIGHT}<br>
      Viewport: ${vw}×${vh} (${aspectRatio}:1)<br>
      Scale: ${this.transform.scale.toFixed(3)}<br>
      Container: ${Math.round(this.transform.containerWidth)}×${Math.round(this.transform.containerHeight)}<br>
      Offset: ${Math.round(this.transform.offsetX)}, ${Math.round(this.transform.offsetY)}
    `.trim()
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.resizeObserver?.disconnect()
    if (this.debugElement) {
      document.body.removeChild(this.debugElement)
    }
    this.container = null
    this.canvas = null
    this.overlay = null
    this.transform = null
    this.debugElement = null
  }
}

// ===== REACT INTEGRATION =====

/**
 * Create a coordinate transformer hook for React components
 */
export function createCoordinateTransformer(manager: StageTransformManager) {
  return {
    /**
     * Transform pointer event coordinates to stage coordinates
     */
    transformPointerEvent: (event: ReactPointerEvent<HTMLElement>): StageCoordinates | null => {
      return manager.transformEventCoordinates(event.nativeEvent)
    },
    
    /**
     * Transform mouse event coordinates to stage coordinates
     */
    transformMouseEvent: (event: ReactMouseEvent<HTMLElement>): StageCoordinates | null => {
      return manager.transformEventCoordinates(event.nativeEvent)
    },
    
    /**
     * Transform touch event coordinates to stage coordinates
     */
    transformTouchEvent: (event: ReactTouchEvent<HTMLElement>): StageCoordinates | null => {
      return manager.transformEventCoordinates(event.nativeEvent)
    }
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

// ===== FACTORY FUNCTIONS =====

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
  PixiApplication?: any
): Promise<Stage2048Instance> {
  
  // Inject CSS if enabled (default: true)
  if (options.autoInjectCSS !== false) {
    ensureStageStyles()
  }
  
  // Ensure we have a Pixi Application constructor
  if (!PixiApplication) {
    try {
      // Try to import Pixi.js dynamically
      const pixi = await import('pixi.js')
      PixiApplication = pixi.Application
    } catch (_error) {
      throw new Error('Pixi.js Application not available. Please provide PixiApplication parameter or install pixi.js')
    }
  }
  
  // Create transform manager
  const transformManager = new StageTransformManager(options.debug)
  
  // Create Pixi application with FIXED dimensions
  const dpr = Math.min(options.dprCap ?? 2, window.devicePixelRatio || 1)
  
  const app = new PixiApplication({
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    backgroundAlpha: options.backgroundAlpha ?? 0,
    antialias: options.antialias ?? true,
    autoDensity: true,
    resolution: dpr
  })

  // Create container and overlay structure
  const container = document.createElement('div')
  const overlay = document.createElement('div')
  
  // Setup DOM structure
  rootElement.classList.add('stage-cover-root')
  rootElement.appendChild(container)
  container.appendChild(app.view as HTMLCanvasElement)
  container.appendChild(overlay)
  
  // Initialize transform system
  transformManager.initialize(
    container,
    app.view as HTMLCanvasElement,
    overlay
  )
  
  // Return complete Stage2048Instance
  return {
    app,
    transformManager,
    
    getOverlay(): HTMLElement | null {
      return container?.querySelector('.stage-cover-overlay') as HTMLElement || null
    },
    
    getTransform(): StageTransform | null {
      return transformManager.getTransform()
    },
    
    transformEventCoordinates(event: PointerEvent | MouseEvent | TouchEvent): StageCoordinates | null {
      return transformManager.transformEventCoordinates(event)
    },
    
    dispose() {
      if (app) {
        try {
          // Remove canvas from DOM
          const canvas = app.view as HTMLCanvasElement
          if (container && container.contains(canvas)) {
            container.removeChild(canvas)
          }
        } catch (e) {
          console.warn('Failed to remove canvas from DOM:', e)
        }

        // Destroy Pixi app
        app.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true
        })
      }

      // Clean up container
      if (container?.parentElement) {
        container.parentElement.removeChild(container)
      }

      // Dispose transform manager
      transformManager.dispose()
    }
  }
}

/**
 * Create just the transform manager (for custom Pixi setups)
 */
export function createTransformManager(debug = false): StageTransformManager {
  return new StageTransformManager(debug)
}

/**
 * Create just the Pixi application with correct dimensions
 */
export function createPixiApplication(options: Stage2048Options = {}, PixiApplication?: any) {
  if (!PixiApplication) {
    throw new Error('PixiApplication constructor required')
  }
  
  const dpr = Math.min(options.dprCap ?? 2, window.devicePixelRatio || 1)
  
  return new PixiApplication({
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    backgroundAlpha: options.backgroundAlpha ?? 0,
    antialias: options.antialias ?? true,
    autoDensity: true,
    resolution: dpr
  })
}