import React from 'react'
import { PixiStageAdapter } from '../utils/stage-pixi-adapter'
import { buildSceneFromLogic } from './logicLoader'
import type { LogicConfig } from './sceneTypes'
import logicConfigJson from './LogicConfig'

export default function LogicStage() {
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    let adapter: PixiStageAdapter | null = null
    let cleanupScene: (() => void) | undefined

    ;(async () => {
      const el = ref.current
      if (!el) return

      try {
        // Create stage adapter with fixed 1024×1024 dimensions
        adapter = new PixiStageAdapter({
          backgroundAlpha: 0,
          antialias: true,
          debug: false // Set to true for development debugging
        })

        // Mount the Pixi stage
        const { app } = await adapter.mount(el)

        // Build and add the scene
        const cfg = logicConfigJson as unknown as LogicConfig
        const scene = await buildSceneFromLogic(app, cfg)
        app.stage.addChild(scene.container)

        cleanupScene = () => {
          try { (scene.container as any)._cleanup?.() } catch {}
          try { scene.container.destroy({ children: true }) } catch {}
        }
      } catch (e) {
        console.error('[LogicStage] Failed to build scene from logic config', e)
      }
    })()

   return () => {
      try { cleanupScene?.() } catch {}
      try { adapter?.dispose() } catch {}
    }
  }, [])

  return (
    <div ref={ref} />
  )
}


