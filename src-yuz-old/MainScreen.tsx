import React from 'react'
import { LauncherBtnPanel } from './ui/LauncherBtn'
import { useLauncherBtnGesture } from './ui/LauncherBtnGesture'
import LogicRendererBadge from './utils/LogicRendererBadge'
import LogicUpdater from './utils/LogicUpdater'
import LogicApiTester from './utils/LogicApiTester'
import StageHost from '@shared/stages/StagePlugin'
import logicConfig from './LogicConfig'
import { createLogicScene } from './function/LayerCreator'

/**
 * Layar utama launcher yang menampilkan navigasi dock.
 * Logic renderer kompleks dihapus untuk sementara.
 */
export default function MainScreen() {
  const gesture = useLauncherBtnGesture()
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Renderer canvas behind UI */}
      <div className="absolute inset-0">
        <StageHost config={logicConfig} createScene={createLogicScene} />
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
      <LogicRendererBadge visible={gesture.open} label="Renderer: PixiJS" />
      <LogicApiTester visible={gesture.open} />
      <LogicUpdater visible={gesture.open} />
    </div>
  )
}




