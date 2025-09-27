import React from 'react'
import type { Container } from 'pixi.js'
import {
  mountStage,
  type StageSceneFactory,
  type StageMountHandle,
  type PixiStageAdapterOptions
} from './StageCore'

export * from './StageCore'

type StageHostProps<Cfg, Result extends { container: Container }> = {
  config: Cfg
  createScene: StageSceneFactory<Cfg, Result>
  className?: string
  stageOptions?: PixiStageAdapterOptions
  onError?: (error: unknown) => void
}

export default function StageHost<Cfg, Result extends { container: Container }>(props: StageHostProps<Cfg, Result>) {
  const { config, createScene, className, stageOptions, onError } = props
  const ref = React.useRef<HTMLDivElement | null>(null)
  const handleRef = React.useRef<StageMountHandle | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    setError(null)

    ;(async () => {
      try {
        const handle = await mountStage(el, config, createScene, stageOptions)
        if (cancelled) {
          handle.dispose()
          return
        }
        handleRef.current = handle
      } catch (err) {
        if (cancelled) return
        onError?.(err)
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[StageHost] Failed to build scene:', err)
        setError(`Failed to initialize stage: ${message}`)
      }
    })()

    return () => {
      cancelled = true
      try { handleRef.current?.dispose() } catch {}
      handleRef.current = null
    }
  }, [config, createScene, stageOptions, onError])

  if (error) {
    return (
      <div className={`w-full h-full flex items-center justify-center text-red-500 ${className ?? ''}`}>
        {error}
      </div>
    )
  }

  return <div ref={ref} className={className ?? 'w-full h-full'} />
}
