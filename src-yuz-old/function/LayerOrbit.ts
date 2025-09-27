import type { Sprite } from 'pixi.js'
import { STAGE_WIDTH, STAGE_HEIGHT } from '@shared/stages/StageCore'

export type OrbitLayerInput = {
  sprite: Sprite
  position: { xPct?: number | null; yPct?: number | null }
  orbitRPM?: number | null
  orbitDir?: 'cw' | 'ccw' | null
  orbitCenter?: { xPct?: number | null; yPct?: number | null } | null
  orbitPhaseDeg?: number | null
  orbitOrientPolicy?: 'none' | 'auto' | 'override' | null
  orbitOrientDeg?: number | null
  spinRPM?: number | null
}

export type OrbitItem = {
  sprite: Sprite
  dir: 1 | -1
  radPerSec: number
  centerUnit: { x: number; y: number }
  centerPx: { cx: number; cy: number }
  radius: number
  basePhase: number
  orientPolicy: 'none' | 'auto' | 'override'
  orientDegRad: number
  spinRpm: number
  positionUnit: { x: number; y: number }
}

export type OrbitBuildResult = {
  items: OrbitItem[]
  recompute(elapsed: number): void
  tick(elapsed: number): void
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function normDeg(deg: number): number {
  const d = deg % 360
  return d < 0 ? d + 360 : d
}

function clampRpm(value: unknown): number {
  const n = typeof value === 'number' ? value : value == null ? 0 : Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(60, Math.max(0, n))
}

function pctToUnit(value: number | null | undefined, fallback: number): number {
  const pct = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return clamp(pct / 100, 0, 1)
}

function projectToRectBorder(
  cx: number,
  cy: number,
  x: number,
  y: number,
  w: number,
  h: number
): { x: number; y: number } {
  if (x >= 0 && x <= w && y >= 0 && y <= h) return { x, y }
  const dx = x - cx
  const dy = y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const eps = 1e-6
  const candidates: { t: number; x: number; y: number }[] = []
  if (Math.abs(dx) > eps) {
    const t1 = (0 - cx) / dx
    const y1 = cy + t1 * dy
    if (t1 > 0 && y1 >= -1 && y1 <= h + 1) candidates.push({ t: t1, x: 0, y: y1 })
    const t2 = (w - cx) / dx
    const y2 = cy + t2 * dy
    if (t2 > 0 && y2 >= -1 && y2 <= h + 1) candidates.push({ t: t2, x: w, y: y2 })
  }
  if (Math.abs(dy) > eps) {
    const t3 = (0 - cy) / dy
    const x3 = cx + t3 * dx
    if (t3 > 0 && x3 >= -1 && x3 <= w + 1) candidates.push({ t: t3, x: x3, y: 0 })
    const t4 = (h - cy) / dy
    const x4 = cx + t4 * dx
    if (t4 > 0 && x4 >= -1 && x4 <= w + 1) candidates.push({ t: t4, x: x4, y: h })
  }
  if (candidates.length === 0) return { x: clamp(x, 0, w), y: clamp(y, 0, h) }
  candidates.sort((a, b) => a.t - b.t)
  const first = candidates[0]
  if (!first) return { x: clamp(x, 0, w), y: clamp(y, 0, h) }
  return { x: first.x, y: first.y }
}

export function buildLayerOrbit(layers: OrbitLayerInput[]): OrbitBuildResult {
  const items: OrbitItem[] = []

  for (const layer of layers) {
    const rpm = clampRpm(layer.orbitRPM)
    if (rpm <= 0) continue

    const centerUnit = {
      x: pctToUnit(layer.orbitCenter?.xPct, 50),
      y: pctToUnit(layer.orbitCenter?.yPct, 50)
    }
    const dir = layer.orbitDir === 'ccw' ? -1 : (1 as 1 | -1)
    const w = STAGE_WIDTH
    const h = STAGE_HEIGHT
    const cx = w * centerUnit.x
    const cy = h * centerUnit.y
    const positionUnit = {
      x: pctToUnit(layer.position.xPct, 0),
      y: pctToUnit(layer.position.yPct, 0)
    }
    const bx = w * positionUnit.x
    const by = h * positionUnit.y
    const start = projectToRectBorder(cx, cy, bx, by, w, h)
    const radius = Math.hypot(start.x - cx, start.y - cy)
    if (radius <= 0) continue

    const phaseDeg = layer.orbitPhaseDeg
    const basePhase = typeof phaseDeg === 'number' && Number.isFinite(phaseDeg)
      ? toRad(normDeg(phaseDeg))
      : Math.atan2(start.y - cy, start.x - cx)
    const radPerSec = (rpm * Math.PI) / 30
    const orientPolicy = (layer.orbitOrientPolicy ?? 'none') as 'none' | 'auto' | 'override'
    const orientDeg = typeof layer.orbitOrientDeg === 'number' && Number.isFinite(layer.orbitOrientDeg)
      ? layer.orbitOrientDeg
      : 0
    const orientDegRad = toRad(normDeg(orientDeg))
    const spinRpm = clampRpm(layer.spinRPM)

    items.push({
      sprite: layer.sprite,
      dir,
      radPerSec,
      centerUnit,
      centerPx: { cx, cy },
      radius,
      basePhase,
      orientPolicy,
      orientDegRad,
      spinRpm,
      positionUnit
    })
  }

  const recompute = (elapsed: number) => {
    for (const it of items) {
      const w = STAGE_WIDTH
      const h = STAGE_HEIGHT
      const cx = w * it.centerUnit.x
      const cy = h * it.centerUnit.y
      const bx = w * it.positionUnit.x
      const by = h * it.positionUnit.y
      const start = projectToRectBorder(cx, cy, bx, by, w, h)
      const radius = Math.hypot(start.x - cx, start.y - cy)
      it.centerPx = { cx, cy }
      it.radius = radius
      if (radius > 0) {
        const currentAngle = Math.atan2(it.sprite.y - cy, it.sprite.x - cx)
        it.basePhase = currentAngle - it.dir * it.radPerSec * elapsed
        it.sprite.x = cx + radius * Math.cos(currentAngle)
        it.sprite.y = cy + radius * Math.sin(currentAngle)
      }
    }
  }

  const tick = (elapsed: number) => {
    for (const it of items) {
      if (it.radius <= 0) continue
      const angle = it.basePhase + it.dir * it.radPerSec * elapsed
      it.sprite.x = it.centerPx.cx + it.radius * Math.cos(angle)
      it.sprite.y = it.centerPx.cy + it.radius * Math.sin(angle)
      if (it.orientPolicy === 'override' || (it.orientPolicy === 'auto' && it.spinRpm <= 0)) {
        it.sprite.rotation = angle + it.orientDegRad
      }
    }
  }

  return { items, recompute, tick }
}

