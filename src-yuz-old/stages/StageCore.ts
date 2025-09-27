import { useCallback, useEffect, useRef, useState, createElement } from 'react'
import type {
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
  HTMLAttributes,
  CSSProperties,
  ReactNode
} from 'react'
import { Application } from 'pixi.js'
import type { Container } from 'pixi.js'
import {
  STAGE_WIDTH as BASE_STAGE_WIDTH,
  STAGE_HEIGHT as BASE_STAGE_HEIGHT,
  DEFAULT_DPR_CAP
} from '../pixi/PixiConstant'

// ===== Stage Transform =====
export const STAGE_WIDTH = BASE_STAGE_WIDTH
export const STAGE_HEIGHT = BASE_STAGE_HEIGHT
export const DISPLAY_SCALE_FACTOR = 1

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

export function calculateStageTransform(viewportWidth: number, viewportHeight: number): StageTransform {
  const scaleX = (viewportWidth / STAGE_WIDTH) * DISPLAY_SCALE_FACTOR
  const scaleY = (viewportHeight / STAGE_HEIGHT) * DISPLAY_SCALE_FACTOR
  const scale = Math.max(scaleX, scaleY)

  const containerWidth = STAGE_WIDTH * scale
  const containerHeight = STAGE_HEIGHT * scale

  return {
    scale,
    offsetX: (viewportWidth - containerWidth) / 2,
    offsetY: (viewportHeight - containerHeight) / 2,
    containerWidth,
    containerHeight
  }
}

export function transformCoordinatesToStage(
  clientX: number,
  clientY: number,
  transform: StageTransform
): StageCoordinates {
  return {
    stageX: (clientX - transform.offsetX) / transform.scale,
    stageY: (clientY - transform.offsetY) / transform.scale
  }
}

export function isWithinStage(stageX: number, stageY: number): boolean {
  return stageX >= 0 && stageX <= STAGE_WIDTH && stageY >= 0 && stageY <= STAGE_HEIGHT
}

export class StageTransformManager {
  private container: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private overlay: HTMLElement | null = null
  private transform: StageTransform | null = null
  private resizeObserver: ResizeObserver | null = null
  private debugElement: HTMLElement | null = null

  constructor(private debug = false) {
    this.resizeObserver = new ResizeObserver(() => this.updateTransform())
  }

  initialize(container: HTMLElement, canvas: HTMLCanvasElement, overlay?: HTMLElement) {
    this.container = container
    this.canvas = canvas
    this.overlay = overlay ?? null

    container.classList.add('stage-cover-container')
    canvas.classList.add('stage-cover-canvas')
    if (overlay) overlay.classList.add('stage-cover-overlay')

    this.resizeObserver?.observe(document.body)
    if (this.debug) this.setupDebug()
    this.updateTransform()
    return this
  }

  updateTransform() {
    if (!this.container || !this.canvas) return
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    this.transform = calculateStageTransform(viewportWidth, viewportHeight)
    this.canvas.style.transform = `scale(${this.transform.scale})`
    this.container.style.width = `${this.transform.containerWidth}px`
    this.container.style.height = `${this.transform.containerHeight}px`
    if (this.debug && this.debugElement) this.updateDebugInfo()
  }

  transformEventCoordinates(event: PointerEvent | MouseEvent | TouchEvent): StageCoordinates | null {
    if (!this.transform) return null
    if ('touches' in event && event.touches.length > 0) {
      const touch = event.touches.item(0)
      if (!touch) return null
      return transformCoordinatesToStage(touch.clientX, touch.clientY, this.transform)
    }
    if ('clientX' in event) {
      return transformCoordinatesToStage(event.clientX, event.clientY, this.transform)
    }
    return null
  }

  getTransform(): StageTransform | null {
    return this.transform
  }

  dispose() {
    this.resizeObserver?.disconnect()
    if (this.debugElement) document.body.removeChild(this.debugElement)
    this.container = null
    this.canvas = null
    this.overlay = null
    this.transform = null
    this.debugElement = null
  }

  private setupDebug() {
    this.debugElement = document.createElement('div')
    this.debugElement.classList.add('stage-cover-debug')
    document.body.appendChild(this.debugElement)
    this.updateDebugInfo()
  }

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
}

export function createCoordinateTransformer(manager: StageTransformManager) {
  return {
    transformPointerEvent: (event: ReactPointerEvent<HTMLElement>): StageCoordinates | null => (
      manager.transformEventCoordinates(event.nativeEvent)
    ),
    transformMouseEvent: (event: ReactMouseEvent<HTMLElement>): StageCoordinates | null => (
      manager.transformEventCoordinates(event.nativeEvent)
    ),
    transformTouchEvent: (event: ReactTouchEvent<HTMLElement>): StageCoordinates | null => (
      manager.transformEventCoordinates(event.nativeEvent)
    )
  }
}

// ===== Gesture Helpers =====
export interface StageGestureOptions {
  transformManager?: StageTransformManager
  holdMs?: number
  moveTolerancePx?: number
}

export interface StageGestureResult {
  open: boolean
  setOpen: (value: boolean) => void
  toggle: () => void
  bindTargetProps: () => HTMLAttributes<HTMLElement>
}

type PressState = {
  active: boolean
  id: number | null
  startX: number
  startY: number
  stageStartX: number
  stageStartY: number
  startedAt: number
  timer: number | null
  consumed: boolean
}

export function useStageGesture(options: StageGestureOptions = {}): StageGestureResult {
  const holdMs = Math.max(120, Math.floor(options.holdMs ?? 450))
  const tolerance = Math.max(2, Math.floor(options.moveTolerancePx ?? 8))
  const transformManager = options.transformManager

  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((value) => !value), [])

  const pressRef = useRef<PressState>({
    active: false,
    id: null,
    startX: 0,
    startY: 0,
    stageStartX: 0,
    stageStartY: 0,
    startedAt: 0,
    timer: null,
    consumed: false
  })

  const clearTimer = useCallback(() => {
    const state = pressRef.current
    if (state.timer !== null) {
      window.clearTimeout(state.timer)
      state.timer = null
    }
  }, [])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const state = pressRef.current
    state.active = true
    state.id = event.pointerId
    state.startX = event.clientX
    state.startY = event.clientY
    state.startedAt = performance.now()
    state.consumed = false

    if (transformManager) {
      const stageCoords = transformManager.transformEventCoordinates(event.nativeEvent)
      if (stageCoords) {
        state.stageStartX = stageCoords.stageX
        state.stageStartY = stageCoords.stageY
      }
    }

    clearTimer()
    state.timer = window.setTimeout(() => {
      if (state.active && !state.consumed) {
        state.consumed = true
        toggle()
      }
    }, holdMs)
  }, [clearTimer, holdMs, toggle, transformManager])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const state = pressRef.current
    if (!state.active || state.id !== event.pointerId) return

    let dx: number
    let dy: number

    if (transformManager) {
      const stageCoords = transformManager.transformEventCoordinates(event.nativeEvent)
      if (stageCoords) {
        dx = stageCoords.stageX - state.stageStartX
        dy = stageCoords.stageY - state.stageStartY
      } else {
        dx = event.clientX - state.startX
        dy = event.clientY - state.startY
      }
    } else {
      dx = event.clientX - state.startX
      dy = event.clientY - state.startY
    }

    if ((dx * dx + dy * dy) > (tolerance * tolerance)) {
      state.active = false
      state.id = null
      state.consumed = false
      clearTimer()
    }
  }, [clearTimer, tolerance, transformManager])

  const endPress = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const state = pressRef.current
    if (!state.active || (state.id !== null && state.id !== event.pointerId)) return
    state.active = false
    state.id = null
    clearTimer()
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {}
  }, [clearTimer])

  const bindTargetProps = useCallback((): HTMLAttributes<HTMLElement> => ({
    onPointerDown,
    onPointerMove,
    onPointerUp: endPress,
    onPointerCancel: endPress
  }), [onPointerDown, onPointerMove, endPress])

  return { open, setOpen, toggle, bindTargetProps }
}

export interface StageGestureAreaProps {
  transformManager?: StageTransformManager
  options?: Omit<StageGestureOptions, 'transformManager'>
  onOpenChange?: (open: boolean) => void
  className?: string
  style?: CSSProperties
  children?: ReactNode | ((state: { open: boolean; toggle: () => void }) => ReactNode)
}

export function StageGestureArea(props: StageGestureAreaProps) {
  const gesture = useStageGesture({ ...props.options, transformManager: props.transformManager })

  useEffect(() => {
    props.onOpenChange?.(gesture.open)
  }, [gesture.open, props])

  return createElement(
    'div',
    {
      ...gesture.bindTargetProps(),
      className: props.className ?? 'absolute inset-0 pointer-events-auto',
      style: props.style
    },
    typeof props.children === 'function'
      ? props.children({ open: gesture.open, toggle: gesture.toggle })
      : props.children
  )
}

// ===== Pixi Stage Adapter =====
export interface PixiStageAdapterOptions {
  debug?: boolean
  dprCap?: number
  backgroundAlpha?: number
  antialias?: boolean
}

export class PixiStageAdapter {
  private app: Application | null = null
  private transformManager: StageTransformManager
  private container: HTMLElement | null = null

  constructor(private options: PixiStageAdapterOptions = {}) {
    this.transformManager = new StageTransformManager(options.debug)
  }

  async mount(rootElement: HTMLElement): Promise<{ app: Application; transformManager: StageTransformManager }> {
    const dpr = Math.min(this.options.dprCap ?? DEFAULT_DPR_CAP, window.devicePixelRatio || 1)

    this.app = new Application({
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      backgroundAlpha: this.options.backgroundAlpha ?? 0,
      antialias: this.options.antialias ?? true,
      autoDensity: true,
      resolution: dpr
    })

    this.container = document.createElement('div')
    const overlay = document.createElement('div')

    rootElement.classList.add('stage-cover-root')
    rootElement.appendChild(this.container)
    this.container.appendChild(this.app.view as HTMLCanvasElement)
    this.container.appendChild(overlay)

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

  dispose() {
    if (this.app) {
      try {
        const canvas = this.app.view as HTMLCanvasElement
        if (this.container && this.container.contains(canvas)) {
          this.container.removeChild(canvas)
        }
      } catch (err) {
        console.warn('[Stage] Failed to remove canvas from DOM:', err)
      }

      this.app.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true
      })
      this.app = null
    }

    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container)
    }
    this.container = null

    this.transformManager.dispose()
  }
}

// ===== mountStage Helper =====
export type StageSceneFactory<Cfg, Result extends { container: Container }> = (
  app: Application,
  cfg: Cfg
) => Promise<Result>

export type StageMountHandle = {
  dispose(): void
}

export async function mountStage<Cfg, Result extends { container: Container }>(
  root: HTMLElement,
  cfg: Cfg,
  createScene: StageSceneFactory<Cfg, Result>,
  opts?: PixiStageAdapterOptions
): Promise<StageMountHandle> {
  const stageAdapter = new PixiStageAdapter(opts)
  const { app } = await stageAdapter.mount(root)

  let sceneContainer: Container | null = null
  try {
    const scene = await createScene(app, cfg)
    sceneContainer = scene.container
    app.stage.addChild(sceneContainer)
  } catch (error) {
    console.error('[Stage] Failed to mount scene', error)
    stageAdapter.dispose()
    throw error
  }

  return {
    dispose() {
      try {
        if (sceneContainer) {
          try { (sceneContainer as any)._cleanup?.() } catch {}
          try { sceneContainer.removeFromParent() } catch {}
          try { sceneContainer.destroy({ children: true }) } catch {}
        }
      } finally {
        stageAdapter.dispose()
      }
    }
  }
}
