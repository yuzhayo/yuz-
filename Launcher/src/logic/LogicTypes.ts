import type { LogicConfig, LayerConfig } from "./sceneTypes";

// Engine-agnostic sprite interface
export interface GenericSprite {
  x: number;
  y: number;
  rotation: number;
  scale: { x: number; y: number; set?: (x: number, y: number) => void };
  alpha: number;
  zIndex?: number;
  visible?: boolean;
  // For effects
  tint?: number;
  blendMode?: any;
  // Engine-specific properties
  [key: string]: any;
}

// Engine-agnostic container interface
export interface GenericContainer {
  addChild?(child: any): void;
  removeChild?(child: any): void;
  children?: any[];
}

// Engine-agnostic application interface
export interface GenericApplication {
  screen?: { width: number; height: number };
  renderer?: any;
  stage?: GenericContainer;
}

// Minimal shared types for the logic pipeline (hub + processors + adapters)

export type BuiltLayer = {
  id: string;
  sprite: GenericSprite;
  cfg: LayerConfig;
};

export type BuildResult = {
  container: GenericContainer;
  layers: BuiltLayer[];
};

export type BuildContext = {
  app: GenericApplication;
  container: GenericContainer;
  cfg: LogicConfig;
  layers: BuiltLayer[];
};

export interface LogicProcessor {
  init(ctx: BuildContext): void;
  onResize?(ctx: BuildContext): void;
  tick?(dt: number, ctx: BuildContext): void;
  dispose?(): void;
}

export interface LogicAdapter<M = unknown> {
  mount(root: HTMLElement, model: M): void;
  update?(model: M): void;
  dispose(): void;
}

// Engine interface following LayerSpin.ts pattern for rendering backends
export type EngineOptions = {
  // Allow backend-specific options
  [key: string]: unknown;
};

export type EngineHandle = {
  dispose(): void;
};

// Main Engine interface with lifecycle pattern similar to LayerSpinManager
export interface LogicEngine {
  init(root: HTMLElement, cfg: LogicConfig, opts?: EngineOptions): Promise<EngineHandle>;
  tick(elapsed: number): void;
  recompute(): void;
  dispose(): void;
}
