import type { Application, Container, Sprite } from 'pixi.js'
import type { LogicConfig, LayerConfig } from './sceneTypes'

// Minimal shared types for the logic pipeline (hub + processors + adapters)

export type BuiltLayer = {
  id: string
  sprite: Sprite
  cfg: LayerConfig
}

export type BuildResult = {
  container: Container
  layers: BuiltLayer[]
}

export type BuildContext = {
  app: Application
  container: Container
  cfg: LogicConfig
  layers: BuiltLayer[]
}

export interface LogicProcessor {
  init(ctx: BuildContext): void
  onResize?(ctx: BuildContext): void
  tick?(dt: number, ctx: BuildContext): void
  dispose?(): void
}

export interface LogicAdapter<M = unknown> {
  mount(root: HTMLElement, model: M): void
  update?(model: M): void
  dispose(): void
}

