import { Assets, Container, Sprite } from 'pixi.js'
import type { Application } from 'pixi.js'
import type { LogicConfig, LayerConfig } from '../LogicConfig'
import { STAGE_WIDTH, STAGE_HEIGHT } from '@shared/stages/StageCore'
import { buildLayerOrbit } from './LayerOrbit'
import { buildLayerSpin, tickLayerSpin } from './LayerSpin'

// Derive z-index from layer id pattern
function logicZIndexFor(cfg: LayerConfig): number {
  const match = cfg.id.match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

// Sort layer configs deterministically by z-index then id
function sortLayersForRender(layers: LayerConfig[]): LayerConfig[] {
  return [...layers].sort((a, b) => {
    const za = logicZIndexFor(a)
    const zb = logicZIndexFor(b)
    if (za !== zb) return za - zb
    return a.id.localeCompare(b.id)
  })
}

// Project layer config onto stage space and set sprite transform
function logicApplyBasicTransform(app: Application, sprite: Sprite, cfg: LayerConfig) {
  const width = STAGE_WIDTH
  const height = STAGE_HEIGHT
  const xPct = cfg.position.xPct ?? 0
  const yPct = cfg.position.yPct ?? 0
  sprite.x = (xPct / 100) * width
  sprite.y = (yPct / 100) * height
  const scale = (cfg.scale?.pct ?? 100) / 100
  sprite.scale.set(scale, scale)
  sprite.zIndex = logicZIndexFor(cfg)
}

// Runtime wrapper for layer sprites and container state
export type BuiltLayer = {
  id: string
  sprite: Sprite
  cfg: LayerConfig
}

export type BuildResult = {
  container: Container
  layers: BuiltLayer[]
}


export function resolveLayerImageUrl(cfg: LogicConfig, layer: LayerConfig): string | null {
  const ref = layer.imageRef
  if (ref.kind === 'url') return ref.url
  const url = cfg.imageRegistry[ref.id]
  return url ?? null
}

export async function createLayerSprite(
  app: Application,
  cfg: LogicConfig,
  layer: LayerConfig
): Promise<BuiltLayer | null> {
  const url = resolveLayerImageUrl(cfg, layer)
  if (!url) {
    console.warn('[logic] Missing image URL for layer', layer.id, layer.imageRef)
    return null
  }

  try {
    const texture = await Assets.load(url)
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    logicApplyBasicTransform(app, sprite, layer)
    return { id: layer.id, sprite, cfg: layer }
  } catch (e) {
    console.error('[logic] Failed to load', url, 'for layer', layer.id, e)
    return null
  }
}

export async function createLogicScene(app: Application, cfg: LogicConfig): Promise<BuildResult> {
  const container = new Container()
  container.sortableChildren = true

  const layers = sortLayersForRender(cfg.layers)
  const built: BuiltLayer[] = []

  const urlSet = new Set<string>()
  for (const layer of layers) {
    const url = resolveLayerImageUrl(cfg, layer)
    if (url) urlSet.add(url)
  }

  await Promise.all(
    Array.from(urlSet).map((url) =>
      Assets.load(url).catch((e) => {
        console.warn('[logic] Preload failed for', url, e)
        return null
      })
    )
  )

  for (const layer of layers) {
    const builtLayer = await createLayerSprite(app, cfg, layer)
    if (!builtLayer) continue
    container.addChild(builtLayer.sprite)
    built.push(builtLayer)
  }

  const { items: spinItems, rpmBySprite: spinRpmBySprite } = buildLayerSpin(
    built.map((b) => ({
      sprite: b.sprite,
      rpm: b.cfg.spinRPM,
      dir: b.cfg.spinDir ?? null
    }))
  )

  const orbit = buildLayerOrbit(
    built.map((b) => ({
      sprite: b.sprite,
      position: b.cfg.position ?? { xPct: 0, yPct: 0 },
      orbitRPM: b.cfg.orbitRPM,
      orbitDir: b.cfg.orbitDir ?? null,
      orbitCenter: b.cfg.orbitCenter ?? null,
      orbitPhaseDeg: b.cfg.orbitPhaseDeg ?? null,
      orbitOrientPolicy: b.cfg.orbitOrientPolicy ?? null,
      orbitOrientDeg: b.cfg.orbitOrientDeg ?? null,
      spinRPM: spinRpmBySprite.get(b.sprite) ?? 0
    }))
  )

  let elapsed = 0

  const onResize = () => {
    for (const b of built) logicApplyBasicTransform(app, b.sprite, b.cfg)
    orbit.recompute(elapsed)
  }
  const resizeListener = () => onResize()
  window.addEventListener('resize', resizeListener)

  const tick = () => {
    if (spinItems.length === 0 && orbit.items.length === 0) return
    const dt = (app.ticker.deltaMS || 16.667) / 1000
    elapsed += dt
    tickLayerSpin(spinItems, elapsed)
    orbit.tick(elapsed)
  }
  if (spinItems.length > 0 || orbit.items.length > 0) {
    app.ticker.add(tick)
  }

  const prevCleanup = (container as any)._cleanup as (() => void) | undefined
  ;(container as any)._cleanup = () => {
    window.removeEventListener('resize', resizeListener)
    if (spinItems.length > 0 || orbit.items.length > 0) {
      app.ticker.remove(tick)
    }
    prevCleanup?.()
  }

  return { container, layers: built }
}

