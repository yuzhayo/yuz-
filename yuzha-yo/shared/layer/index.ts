/**
 * Basic Layer System - Module Exports
 * 
 * Centralized exports for the Basic Layer System components
 */

// Core pipeline
export { LayerBasicCore } from './LayerBasicCore'

// Type definitions
export type {
  ImageRegistry,
  ImageRef,
  LayerConfig,
  LogicConfig,
  ClockHand,
  ClockHandSelection,
  ClockCenterConfig,
  ClockAngleConfig,
  ClockRadiusConfig,
  ClockConfig
} from './LayerBasicTypes'

// Constants (value exports)
export {
  LAYER_CANVAS_WIDTH,
  LAYER_CANVAS_HEIGHT
} from './LayerBasicTypes'

// Asset management
export {
  remapRegistry,
  getUrlForImageRef,
  loadTexture,
  disposeTextureCache
} from './LayerBasicAssets'

// Transform processing
export {
  logicZIndexFor,
  processLayerTransform,
  applyTransformToMesh
} from './LayerBasicTransform'
export type { TransformData } from './LayerBasicTransform'

// Three.js rendering
export { LayerBasicRenderer } from './LayerBasicRenderer'
export type { RenderedLayer, RendererOptions } from './LayerBasicRenderer'

// Mathematical utilities
export {
  toRad,
  toDeg,
  normDeg,
  clamp,
  clamp01,
  clampRpm60,
  percentToWorldCoords,
  worldCoordsToPercent,
  percentToScale,
  layerToThreeCoords,
  threeToLayerCoords,
  lerp,
  smoothStep,
  smootherStep
} from './LayerBasicMath'