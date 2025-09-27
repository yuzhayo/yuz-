import React from 'react'
import { LauncherBtnPanel } from './LauncherBtn'
import { useLauncherBtnGesture } from './LauncherBtnGesture'
import MainScreenRendererBadge from './MainScreenRendererBadge'
import MainScreenUpdater from './MainScreenUpdater'
import MainScreenApiTester from './MainScreenApiTester'
import LogicStage from './logic/LogicStage'
import LogicStageDom from './logic/LogicStageDom'
import { detectRenderer, type RendererMode } from './logic/LogicCapability'

export type MainScreenProps = {
  rendererMode?: RendererMode // 'auto' | 'pixi' | 'dom'
}

/**
 * Layar utama launcher yang menampilkan navigasi dock.
 * Logic renderer kompleks dihapus untuk sementara.
 */
export default function MainScreen(props: MainScreenProps) {
  const mode = props.rendererMode ?? 'auto'
  const chosen = detectRenderer(mode)
  const gesture = useLauncherBtnGesture()
  const label = chosen === 'pixi' ? 'Renderer: Pixi' : 'Renderer: DOM'
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Renderer canvas behind UI */}
      <div className="absolute inset-0">
        {chosen === 'pixi' ? <LogicStage /> : <LogicStageDom />}
      </div>
      {/* Invisible gesture target */}
      <div {...gesture.bindTargetProps()} className="absolute inset-0 pointer-events-auto" />
      {/* Area utama untuk konten launcher */}
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">'''</h1>
          <p className="text-slate-300">
            Hold tap anywhere to access modules
          </p>
        </div>
      </div>

      {/* Navigation dock */}
      <LauncherBtnPanel
        open={gesture.open}
        onToggle={gesture.toggle}
        effect={{ kind: 'fade' }}
        title="Modules"
        target="_self"
      />
      {/* Renderer badge and updater (hold with launcher) */}
      <MainScreenRendererBadge visible={gesture.open} label={label} />
      <MainScreenApiTester visible={gesture.open} />
      <MainScreenUpdater visible={gesture.open} />
    </div>
  )
}
