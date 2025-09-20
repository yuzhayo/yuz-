import type { Application, Sprite } from 'pixi.js'
import type { BuiltLayer } from './LogicTypes'
import { clampRpm60 } from './LogicMath'

export type SpinItem = { sprite: Sprite; baseRad: number; radPerSec: number; dir: 1 | -1 }

export function buildSpin(app: Application, built: BuiltLayer[]) {
  const items: SpinItem[] = []
  const rpmBySprite = new Map<Sprite, number>()
  for (const b of built) {
    const clk = b.cfg.clock
    if (clk?.enabled) {
      rpmBySprite.set(b.sprite, 0)
      continue
    }
    const rpm = clampRpm60(b.cfg.spinRPM)
    if (rpm > 0) {
      const dir = (b.cfg.spinDir === 'ccw') ? -1 : 1 as 1 | -1
      const baseRad = b.sprite.rotation
      const radPerSec = (rpm * Math.PI) / 30
      items.push({ sprite: b.sprite, baseRad, radPerSec, dir })
    }
    rpmBySprite.set(b.sprite, rpm)
  }
  return { items, rpmBySprite }
}

export function tickSpin(items: SpinItem[], elapsed: number) {
  for (const it of items) {
    it.sprite.rotation = it.baseRad + it.dir * it.radPerSec * elapsed
  }
}

