import type { Application } from 'pixi.js'
import type { BuiltLayer } from './LogicTypes'
import type { LayerConfig } from './sceneTypes'

type FadeSpec = { type: 'fade'; from: number; to: number; durationMs: number; loop: boolean; easing: 'linear' | 'sineInOut' }
type PulseSpec = { type: 'pulse'; property: 'scale' | 'alpha'; amp: number; periodMs: number; phaseDeg: number }
type TiltSpec = { type: 'tilt'; mode: 'pointer' | 'device' | 'time'; axis: 'both' | 'x' | 'y'; maxDeg: number; periodMs?: number }
type EffectSpec = FadeSpec | PulseSpec | TiltSpec

type EffectItem = {
  spriteIdx: number
  specs: EffectSpec[]
  baseAlpha: number
  baseScale: number
  prevTiltRad?: number
}

function normFade(e: any): FadeSpec {
  return {
    type: 'fade',
    from: typeof e.from === 'number' ? e.from : 1,
    to: typeof e.to === 'number' ? e.to : 1,
    durationMs: typeof e.durationMs === 'number' && e.durationMs > 0 ? e.durationMs : 1000,
    loop: e.loop !== false,
    easing: e.easing === 'sineInOut' ? 'sineInOut' : 'linear',
  }
}

function normPulse(e: any): PulseSpec {
  return {
    type: 'pulse',
    property: e.property === 'alpha' ? 'alpha' : 'scale',
    amp: typeof e.amp === 'number' ? e.amp : (e.property === 'alpha' ? 0.1 : 0.05),
    periodMs: typeof e.periodMs === 'number' && e.periodMs > 0 ? e.periodMs : 1000,
    phaseDeg: typeof e.phaseDeg === 'number' ? e.phaseDeg : 0,
  }
}

function normTilt(e: any): TiltSpec {
  const mode: TiltSpec['mode'] = (e.mode === 'device' || e.mode === 'time') ? e.mode : 'pointer'
  const axis: TiltSpec['axis'] = (e.axis === 'x' || e.axis === 'y') ? e.axis : 'both'
  const maxDeg = typeof e.maxDeg === 'number' ? e.maxDeg : 8
  const periodMs = typeof e.periodMs === 'number' && e.periodMs > 0 ? e.periodMs : 4000
  return { type: 'tilt', mode, axis, maxDeg, periodMs }
}

function parseEffects(cfg: LayerConfig): EffectSpec[] {
  const list = cfg.effects
  if (!Array.isArray(list) || list.length === 0) return []
  const out: EffectSpec[] = []
  for (const e of list) {
    if (!e || typeof e !== 'object') continue
    if ((e as any).type === 'fade') out.push(normFade(e))
    else if ((e as any).type === 'pulse') out.push(normPulse(e))
    else if ((e as any).type === 'tilt') out.push(normTilt(e))
  }
  return out
}

export function buildEffects(app: Application, built: BuiltLayer[]) {
  const items: EffectItem[] = []
  // pointer state (0..1)
  let px = 0.5
  let py = 0.5
  const onMouse = (ev: MouseEvent) => {
    const w = window.innerWidth || 1
    const h = window.innerHeight || 1
    px = Math.max(0, Math.min(1, ev.clientX / w))
    py = Math.max(0, Math.min(1, ev.clientY / h))
  }
  const onTouch = (ev: TouchEvent) => {
    const t = ev.touches && ev.touches[0]
    if (!t) return
    const w = window.innerWidth || 1
    const h = window.innerHeight || 1
    px = Math.max(0, Math.min(1, t.clientX / w))
    py = Math.max(0, Math.min(1, t.clientY / h))
  }
  try {
    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
  } catch {}
  built.forEach((b, idx) => {
    const specs = parseEffects(b.cfg)
    if (specs.length === 0) return
    // base scale from config percent; Basic sets it already, but we store the nominal
    const baseScale = (b.cfg.scale?.pct ?? 100) / 100
    const baseAlpha = 1
    items.push({ spriteIdx: idx, specs, baseAlpha, baseScale })
  })

  function easeLinear(t: number) { return t }
  function easeSineInOut(t: number) { return 0.5 - 0.5 * Math.cos(Math.PI * 2 * t) }

  function tick(elapsed: number, builtRef: BuiltLayer[]) {
    for (const it of items) {
      const b = builtRef[it.spriteIdx]
      if (!b) continue
      let alpha = it.baseAlpha
      let scaleMul = 1
      let tiltRad = 0
      for (const e of it.specs) {
        if (e.type === 'fade') {
          const T = e.durationMs / 1000
          if (T <= 0) continue
          let phase = (elapsed % T) / T
          if (e.loop) {
            // ping-pong
            if (phase > 0.5) phase = 1 - (phase - 0.5) * 2; else phase = phase * 2
          }
          const t = e.easing === 'sineInOut' ? easeSineInOut(phase) : easeLinear(phase)
          alpha = e.from + (e.to - e.from) * t
        } else if (e.type === 'pulse') {
          // pulse
          const T = e.periodMs / 1000
          if (T <= 0) continue
          const omega = (2 * Math.PI) / T
          const phase = (e.phaseDeg || 0) * Math.PI / 180
          const s = 1 + e.amp * Math.sin(omega * elapsed + phase)
          if (e.property === 'scale') scaleMul *= s
          else alpha *= Math.max(0, Math.min(1, s))
        } else if (e.type === 'tilt') {
          const axisCount = e.axis === 'both' ? 2 : 1
          if (e.mode === 'time') {
            const T = (e.periodMs ?? 4000) / 1000
            if (T > 0) {
              const s = Math.sin((2 * Math.PI / T) * elapsed)
              const deg = e.maxDeg * s
              tiltRad += (deg * Math.PI) / 180
            }
          } else {
            const dx = (px - 0.5) * 2
            const dy = (py - 0.5) * 2
            let v = 0
            if (e.axis === 'x') v = dy
            else if (e.axis === 'y') v = -dx
            else v = (dy + -dx) / axisCount
            const deg = Math.max(-e.maxDeg, Math.min(e.maxDeg, v * e.maxDeg))
            tiltRad += (deg * Math.PI) / 180
          }
        }
      }
      b.sprite.alpha = Math.max(0, Math.min(1, alpha))
      const finalScale = it.baseScale * scaleMul
      b.sprite.scale.set(finalScale, finalScale)
      const prev = it.prevTiltRad || 0
      if (tiltRad !== prev) {
        b.sprite.rotation += (tiltRad - prev)
        it.prevTiltRad = tiltRad
      }
    }
  }

  function cleanup() {
    try { window.removeEventListener('mousemove', onMouse as any) } catch {}
    try { window.removeEventListener('touchmove', onTouch as any) } catch {}
  }

  return { items, tick, cleanup }
}

