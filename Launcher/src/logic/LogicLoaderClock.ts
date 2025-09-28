const DEBUG_CLOCK = import.meta.env?.VITE_CLOCK_DEBUG === '1'

const WARNED_CLOCK = new Set<string>()
function warnClock(layerId: string, message: string) {
  const key = `${layerId}:${message}`
  if (WARNED_CLOCK.has(key)) return
  WARNED_CLOCK.add(key)
  console.warn('[logic][clock]', message, 'layer', layerId)
}

function debugClock(layerId: string, ...data: unknown[]) {
  if (!DEBUG_CLOCK) return
  console.info('[logic][clock][debug]', layerId, ...data)
}

import type { Application, Sprite } from 'pixi.js'
import type { BuiltLayer } from './LogicTypes'
import type { ClockConfig, ClockHand, LayerConfig } from './sceneTypes'
import { clamp, toRad } from './LogicMath'
import { STAGE_WIDTH, STAGE_HEIGHT } from '@shared/stages/Stage2048'

type Vec2 = { x: number; y: number }

type TimeSource = {
  mode: 'device' | 'utc' | 'server'
  tzOffsetMinutes?: number | null
}

type ClockGeometry = {
  baseLocal: Vec2
  tipLocal: Vec2
  baseTipAngle: number
  baseTipLength: number
  sourceWidth: number
  sourceHeight: number
}

type SpinRadius = {
  value: number | null
  pct: number | null
}

type SpinSettings = {
  hand: ClockHand | null
  radius: SpinRadius
  staticAngle: number
  phase: number
}

type OrbitSettings = {
  hand: ClockHand | null
  centerPct: { xPct: number; yPct: number }
  centerPx: Vec2
  radius: number
  phase: number
}

type ClockItem = {
  sprite: Sprite
  cfg: LayerConfig
  clock: ClockConfig
  geometry: ClockGeometry
  positionFallback: { xPct: number; yPct: number }
  centerPct: { xPct: number; yPct: number }
  centerPx: Vec2
  spin: SpinSettings
  orbit: OrbitSettings | null
  time: { source: TimeSource; smooth: boolean; format: 12 | 24 }
}

function getSpriteDimensions(sp: Sprite): { width: number; height: number } | null {
  const tex = sp.texture
  const width = tex.orig?.width ?? tex.width ?? sp.width
  const height = tex.orig?.height ?? tex.height ?? sp.height
  if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

function pointOnRect(width: number, height: number, angleRad: number): Vec2 {
  if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return { x: 0, y: 0 }
  const hw = width / 2
  const hh = height / 2
  const dx = Math.cos(angleRad)
  const dy = Math.sin(angleRad)
  const eps = 1e-6
  const candidates: Array<{ t: number; x: number; y: number }> = []
  if (Math.abs(dx) > eps) {
    const sx = dx > 0 ? hw : -hw
    const tx = sx / dx
    const y = tx * dy
    if (tx >= 0 && Math.abs(y) <= hh + 1e-4) candidates.push({ t: tx, x: dx * tx, y })
  }
  if (Math.abs(dy) > eps) {
    const sy = dy > 0 ? hh : -hh
    const ty = sy / dy
    const x = ty * dx
    if (ty >= 0 && Math.abs(x) <= hw + 1e-4) candidates.push({ t: ty, x, y: dy * ty })
  }
  if (candidates.length === 0) return { x: 0, y: 0 }
  candidates.sort((a, b) => a.t - b.t)
  const best = candidates[0]
  if (!best) return { x: 0, y: 0 }
  return { x: best.x, y: best.y }
}


function clampCenter(center: ClockConfig['center'] | null | undefined, fallback: { xPct: number; yPct: number }): { xPct: number; yPct: number } {
  const x = typeof center?.xPct === 'number' && isFinite(center.xPct) ? center.xPct : fallback.xPct
  const y = typeof center?.yPct === 'number' && isFinite(center.yPct) ? center.yPct : fallback.yPct
  return {
    xPct: clamp(x, 0, 100),
    yPct: clamp(y, 0, 100),
  }
}

function pctToStage(center: { xPct: number; yPct: number }): Vec2 {
  return {
    x: (center.xPct / 100) * STAGE_WIDTH,
    y: (center.yPct / 100) * STAGE_HEIGHT,
  }
}

function computeGeometry(sprite: Sprite, clock: ClockConfig, layerId: string): ClockGeometry | null {
  const dims = getSpriteDimensions(sprite)
  if (!dims) {
    warnClock(layerId, 'missing texture dimensions')
    return null
  }
  const baseAngle = toRad(clock.base?.angleDeg ?? 0)
  const tipAngle = toRad(clock.tip?.angleDeg ?? 0)
  const baseLocal = pointOnRect(dims.width, dims.height, baseAngle)
  const tipLocal = pointOnRect(dims.width, dims.height, tipAngle)
  const baseTipVec = { x: tipLocal.x - baseLocal.x, y: tipLocal.y - baseLocal.y }
  const baseTipLength = Math.hypot(baseTipVec.x, baseTipVec.y)
  if (!isFinite(baseTipLength) || baseTipLength <= 1e-3) {
    warnClock(layerId, 'invalid base/tip configuration')
    return null
  }
  const baseTipAngle = Math.atan2(baseTipVec.y, baseTipVec.x)
  return {
    baseLocal,
    tipLocal,
    baseTipAngle,
    baseTipLength,
    sourceWidth: dims.width,
    sourceHeight: dims.height,
  }
}

// Note: resolveSpinRadius moved to LayerSpin.ts

function resolveTimeSource(clock: ClockConfig): TimeSource {
  const tz = clock.timezone ?? 'device'
  const offset = clock.source?.tzOffsetMinutes ?? null
  if (tz === 'utc') return { mode: 'utc', tzOffsetMinutes: offset }
  if (tz === 'server') return { mode: 'server', tzOffsetMinutes: offset }
  return { mode: 'device', tzOffsetMinutes: offset }
}

function getTimeParts(src: TimeSource) {
  const now = Date.now()
  if (src.mode === 'device' && src.tzOffsetMinutes == null) {
    const d = new Date(now)
    return { H: d.getHours(), M: d.getMinutes(), S: d.getSeconds(), ms: d.getMilliseconds() }
  }
  const shift = (src.tzOffsetMinutes ?? 0) * 60000
  const d = new Date(now + shift)
  return {
    H: d.getUTCHours(),
    M: d.getUTCMinutes(),
    S: d.getUTCSeconds(),
    ms: d.getUTCMilliseconds(),
  }
}

function timeAngleRad(parts: { H: number; M: number; S: number; ms: number }, hand: ClockHand, format: 12 | 24, smooth: boolean): number {
  const { H, M, S, ms } = parts
  if (hand === 'second') {
    const s = S + (smooth ? ms / 1000 : 0)
    return (2 * Math.PI) * (s / 60)
  }
  if (hand === 'minute') {
    const m = M + (smooth ? S / 60 : 0)
    return (2 * Math.PI) * (m / 60)
  }
  const h = (format === 24)
    ? (H + (smooth ? M / 60 + S / 3600 : 0)) / 24
    : (((H % 12) + (smooth ? M / 60 + S / 3600 : 0)) / 12)
  return (2 * Math.PI) * h
}

function createClockItem(b: BuiltLayer): ClockItem | null {
  const clock = b.cfg.clock
  if (!clock || !clock.enabled) return null

  const geometry = computeGeometry(b.sprite, clock, b.cfg.id)
  if (!geometry) return null

  const positionFallback = { xPct: b.cfg.position.xPct ?? 0, yPct: b.cfg.position.yPct ?? 0 }
  const centerPct = clampCenter(clock.center, positionFallback)
  const centerPx = pctToStage(centerPct)

  const spinHand = clock.spinHand && clock.spinHand !== 'none' ? clock.spinHand : null
  const orbitHand = clock.orbitHand && clock.orbitHand !== 'none' ? clock.orbitHand : null

  // Note: Spin logic now handled by LayerSpin module
  const spin = {
    hand: spinHand,
    radius: { value: null, pct: null }, // Placeholder - actual logic in LayerSpin
    staticAngle: spinHand ? 0 : toRad(clock.tip?.angleDeg ?? 0),
    phase: 0,
  }

  const timeSource = resolveTimeSource(clock)
  const smooth = clock.smooth ?? true
  const format = clock.format === 24 ? 24 : 12

  let orbit: OrbitSettings | null = null
  if (orbitHand) {
    const orbitCenterPct = clampCenter(clock.orbitCenter, centerPct)
    const orbitCenterPx = pctToStage(orbitCenterPct)
    const dx = centerPx.x - orbitCenterPx.x
    const dy = centerPx.y - orbitCenterPx.y
    const radius = Math.hypot(dx, dy)
    if (radius <= 1e-3) {
      warnClock(b.cfg.id, 'orbitHand set but radius is zero; disabling orbit')
      orbit = {
        hand: null,
        centerPct: orbitCenterPct,
        centerPx: orbitCenterPx,
        radius: 0,
        phase: 0,
      }
    } else {
      const parts = getTimeParts(timeSource)
      const nowAngle = timeAngleRad(parts, orbitHand, format, smooth)
      orbit = {
        hand: orbitHand,
        centerPct: orbitCenterPct,
        centerPx: orbitCenterPx,
        radius,
        phase: Math.atan2(dy, dx) - nowAngle,
      }
    }
  }

  debugClock(b.cfg.id, 'resolved', {
    centerPct,
    spinHand,
    orbitHand,
    orbitRadius: orbit?.radius ?? null
  })

  return {
    sprite: b.sprite,
    cfg: b.cfg,
    clock,
    geometry,
    positionFallback,
    centerPct,
    centerPx,
    spin,
    orbit,
    time: { source: timeSource, smooth, format },
  }
}

function recomputeItem(item: ClockItem) {
  item.centerPct = clampCenter(item.clock.center, item.positionFallback)
  item.centerPx = pctToStage(item.centerPct)

  if (item.orbit) {
    item.orbit.centerPct = clampCenter(item.clock.orbitCenter, item.centerPct)
    item.orbit.centerPx = pctToStage(item.orbit.centerPct)
    const dx = item.centerPx.x - item.orbit.centerPx.x
    const dy = item.centerPx.y - item.orbit.centerPx.y
    const radius = Math.hypot(dx, dy)
    item.orbit.radius = radius
    if (item.orbit.hand && radius > 1e-3) {
      const parts = getTimeParts(item.time.source)
      const nowAngle = timeAngleRad(parts, item.orbit.hand, item.time.format, item.time.smooth)
      item.orbit.phase = Math.atan2(dy, dx) - nowAngle
    } else {
      if (item.orbit.hand) warnClock(item.cfg.id, 'orbit radius collapsed; disabling orbit')
      item.orbit.phase = radius > 1e-3 ? Math.atan2(dy, dx) : 0
      if (radius <= 1e-3) item.orbit.hand = null
    }
  }

  const geom = computeGeometry(item.sprite, item.clock, item.cfg.id)
  if (geom) item.geometry = geom

  // Note: Spin-related logic moved to LayerSpin.ts
}

// Note: resolveSpinRadiusPx moved to LayerSpin.ts

function tickClock(items: ClockItem[]) {
  if (items.length === 0) return
  for (const item of items) {
    const parts = getTimeParts(item.time.source)
    const smooth = item.time.smooth
    const format = item.time.format

    let centerX = item.centerPx.x
    let centerY = item.centerPx.y

    // Handle orbital motion for clock hands
    if (item.orbit) {
      if (item.orbit.radius > 1e-3) {
        const orbitAngle = (item.orbit.hand ? timeAngleRad(parts, item.orbit.hand, format, smooth) : 0) + item.orbit.phase
        centerX = item.orbit.centerPx.x + item.orbit.radius * Math.cos(orbitAngle)
        centerY = item.orbit.centerPx.y + item.orbit.radius * Math.sin(orbitAngle)
      } else {
        centerX = item.orbit.centerPx.x
        centerY = item.orbit.centerPx.y
      }
      
      // For orbital items, just update position - spin is handled by LayerSpin module
      item.sprite.x = centerX
      item.sprite.y = centerY
    }
    
    // Note: Spin logic is now handled by LayerSpin module
    // This function now focuses only on orbital clock behavior
  }
}

export function buildClock(app: Application, built: BuiltLayer[]) {
  const items: ClockItem[] = []
  for (const b of built) {
    const item = createClockItem(b)
    if (item) items.push(item)
  }

  const tick = () => tickClock(items)
  const recompute = () => {
    for (const item of items) recomputeItem(item)
  }

  return { items, tick, recompute }
}



















