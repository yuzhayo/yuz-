import { Application } from 'pixi.js'
import type { Container } from 'pixi.js'
import type { LogicConfig } from './sceneTypes'
import { buildSceneFromLogic } from './logicLoader'

export type PixiAdapterOptions = {
  dprCap?: number
  resizeTo?: Window | HTMLElement
  backgroundAlpha?: number
  antialias?: boolean
}

export type PixiAdapterHandle = {
  dispose(): void
}

export async function mountPixi(
  root: HTMLElement,
  cfg: LogicConfig,
  opts?: PixiAdapterOptions
): Promise<PixiAdapterHandle> {
  const dpr = Math.min(opts?.dprCap ?? 2, (window.devicePixelRatio || 1))
  const app = new Application({
    resizeTo: opts?.resizeTo ?? window,
    backgroundAlpha: opts?.backgroundAlpha ?? 0,
    antialias: opts?.antialias ?? true,
    autoDensity: true,
    resolution: dpr
  })

  root.appendChild(app.view as HTMLCanvasElement)

  let sceneContainer: Container | null = null
  try {
    const scene = await buildSceneFromLogic(app, cfg)
    sceneContainer = scene.container
    app.stage.addChild(sceneContainer)
  } catch (e) {    console.error('[LogicRendererPixi] Failed to mount scene', e)
  }

  return {
    dispose() {
      try {
        if (sceneContainer) {
          try { (sceneContainer as any)._cleanup?.() } catch {}
          try { sceneContainer.destroy({ children: true }) } catch {}
        }
      } finally {
        try {
          if (root.contains(app.view as HTMLCanvasElement)) {
            root.removeChild(app.view as HTMLCanvasElement)
          }
        } catch {}
        app.destroy(true, { children: true, texture: true, baseTexture: true })
      }
    }
  }
}



