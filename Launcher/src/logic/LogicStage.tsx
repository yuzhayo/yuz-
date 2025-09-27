import React from 'react'
import { createStage2048 } from '@shared/stages/Stage2048'
import { buildSceneFromLogic } from './logicLoader'
import type { LogicConfig } from './sceneTypes'
import logicConfigJson from '../LogicConfig'

export default function LogicStage() {
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    let stage: any = null
    let cleanupScene: (() => void) | undefined

    ;(async () => {
      const el = ref.current
      if (!el) return

      try {
        // Create stage with 2048×2048 dimensions using the new module
        stage = await createStage2048(el, {
          backgroundAlpha: 0,
          antialias: true,
          debug: false, // Set to true for development debugging
          autoInjectCSS: true
        })

        // Build and add the scene
        const cfg = logicConfigJson as unknown as LogicConfig
        const scene = await buildSceneFromLogic(stage.app, cfg)
        stage.app.stage.addChild(scene.container)

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
      try { stage?.dispose() } catch {}
    }
  }, [])

  return (
    <div ref={ref} />
  )
}


