/**
 * Stage Gesture Adapter
 * Enhances existing gesture handling with coordinate transformation
 */

import { useState, useCallback, useRef, useEffect, createElement } from 'react'
import type { PointerEvent as ReactPointerEvent, HTMLAttributes, CSSProperties, ReactNode } from 'react'
import type { StageTransformManager } from './stage-transform'

export interface StageGestureOptions {
  /** Coordinate transformer manager */
  transformManager?: StageTransformManager
  /** Original gesture options */
  holdMs?: number
  moveTolerancePx?: number
}

export interface StageGestureResult {
  /** Original gesture properties */
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
  /** Enhanced binding function with coordinate transformation */
  bindTargetProps: () => HTMLAttributes<HTMLElement>
}

type PressState = {
  active: boolean
  id: number | null
  startX: number
  startY: number
  startedAt: number
  timer: number | null
  consumed: boolean
  // Stage coordinates
  stageStartX: number
  stageStartY: number
}

/**
 * Enhanced gesture hook with coordinate transformation for stage system
 */
export function useStageGesture(opts?: StageGestureOptions): StageGestureResult {
  const holdMs = Math.max(120, Math.floor(opts?.holdMs ?? 450))
  const tol = Math.max(2, Math.floor(opts?.moveTolerancePx ?? 8))
  const transformManager = opts?.transformManager

  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen(v => !v), [])

  const pressRef = useRef<PressState>({
    active: false,
    id: null,
    startX: 0,
    startY: 0,
    startedAt: 0,
    timer: null,
    consumed: false,
    stageStartX: 0,
    stageStartY: 0
  })

  const clearTimer = useCallback(() => {
    const p = pressRef.current
    if (p.timer !== null) {
      window.clearTimeout(p.timer)
      p.timer = null
    }
  }, [])

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!e.isPrimary) return
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)

    const p = pressRef.current
    p.active = true
    p.id = e.pointerId
    p.startX = e.clientX
    p.startY = e.clientY
    p.startedAt = performance.now()
    p.consumed = false

    // Transform coordinates if transform manager is available
    if (transformManager) {
      const stageCoords = transformManager.transformEventCoordinates(e.nativeEvent)
      if (stageCoords) {
        p.stageStartX = stageCoords.stageX
        p.stageStartY = stageCoords.stageY
      }
    }

    clearTimer()
    p.timer = window.setTimeout(() => {
      if (p.active && !p.consumed) {
        p.consumed = true
        toggle()
      }
    }, holdMs)
  }, [clearTimer, holdMs, toggle, transformManager])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const p = pressRef.current
    if (!p.active || p.id !== e.pointerId) return

    let dx: number, dy: number

    if (transformManager) {
      // Use stage coordinates for movement calculation
      const stageCoords = transformManager.transformEventCoordinates(e.nativeEvent)
      if (stageCoords) {
        dx = stageCoords.stageX - p.stageStartX
        dy = stageCoords.stageY - p.stageStartY
      } else {
        // Fallback to viewport coordinates
        dx = e.clientX - p.startX
        dy = e.clientY - p.startY
      }
    } else {
      // Use viewport coordinates
      dx = e.clientX - p.startX
      dy = e.clientY - p.startY
    }

    if ((dx * dx + dy * dy) > (tol * tol)) {
      p.active = false
      p.id = null
      p.consumed = false
      clearTimer()
    }
  }, [clearTimer, tol, transformManager])

  const endPress = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const p = pressRef.current
    if (!p.active || (p.id !== null && p.id !== e.pointerId)) return
    p.active = false
    p.id = null
    clearTimer()
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId) } catch {}
  }, [clearTimer])

  const bindTargetProps = useCallback((): HTMLAttributes<HTMLElement> => {
    return {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPress,
      onPointerCancel: endPress
    }
  }, [onPointerDown, onPointerMove, endPress])

  return {
    open,
    setOpen,
    toggle,
    bindTargetProps
  }
}

/**
 * Gesture area component that integrates with stage transform system
 */
export interface StageGestureAreaProps {
  /** Transform manager for coordinate conversion */
  transformManager?: StageTransformManager
  /** Gesture options */
  options?: Omit<StageGestureOptions, 'transformManager'>
  /** Called when gesture state changes */
  onOpenChange?: (open: boolean) => void
  /** Overlay class name */
  className?: string
  /** Overlay style */
  style?: CSSProperties
  /** Child content */
  children?: ReactNode | ((state: { open: boolean; toggle: () => void }) => ReactNode)
}

export function StageGestureArea(props: StageGestureAreaProps) {
  const gesture = useStageGesture({
    ...props.options,
    transformManager: props.transformManager
  })

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


