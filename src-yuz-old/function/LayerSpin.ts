import type { Sprite } from 'pixi.js'

export type SpinLayerInput = {
  sprite: Sprite
  rpm?: number | null
  dir?: 'cw' | 'ccw' | null
}

export type SpinItem = {
  sprite: Sprite
  baseRad: number
  radPerSec: number
  dir: 1 | -1
}

export type SpinBuildResult = {
  items: SpinItem[]
  rpmBySprite: Map<Sprite, number>
}

function clampRpm(value: unknown): number {
  const n = typeof value === 'number' ? value : value == null ? 0 : Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(60, Math.max(0, n))
}

export function buildLayerSpin(layers: SpinLayerInput[]): SpinBuildResult {
  const items: SpinItem[] = []
  const rpmBySprite = new Map<Sprite, number>()

  for (const layer of layers) {
    const rpm = clampRpm(layer.rpm)
    rpmBySprite.set(layer.sprite, rpm)
    if (rpm <= 0) continue

    const dir = layer.dir === 'ccw' ? -1 : (1 as 1 | -1)
    const baseRad = layer.sprite.rotation || 0
    const radPerSec = (rpm * Math.PI) / 30

    items.push({ sprite: layer.sprite, baseRad, radPerSec, dir })
  }

  return { items, rpmBySprite }
}

export function tickLayerSpin(items: SpinItem[], elapsed: number): void {
  if (!items.length) return
  for (const it of items) {
    if (!it.sprite) continue
    it.sprite.rotation = it.baseRad + it.dir * it.radPerSec * elapsed
  }
}
