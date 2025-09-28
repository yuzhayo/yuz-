# Logic Pipeline Documentation

## Overview

The Logic Pipeline is a comprehensive system for creating animated, interactive scenes with configurable visual effects. It supports both PixiJS (WebGL) and DOM rendering backends, providing a unified API for layer-based animations with capabilities including rotation, orbital motion, clock-driven animations, and various visual effects.

## Architecture Overview

The pipeline follows a modular architecture with these main components:

1. **Core Types & Configuration** - Type definitions and scene configuration
2. **Utilities** - Math helpers, capability detection, and timing
3. **Layer Management** - Creation, transformation, and animation of individual layers
4. **Effects System** - Visual effects from basic (fade/pulse) to advanced (glow/bloom)
5. **Rendering Backends** - PixiJS and DOM implementations
6. **Stage Components** - React components for integration

## File-by-File Analysis

### Core Types & Configuration

#### LogicTypes.ts
**Purpose**: Defines core type interfaces for the entire pipeline

**Key Exports**:
- `BuiltLayer`: Represents a layer with sprite, ID, and configuration
- `BuildResult`: Container with built layers array
- `BuildContext`: Shared context for processors (app, container, config, layers)
- `LogicProcessor`: Interface for animation processors (spin, orbit, effects)
- `LogicAdapter<M>`: Interface for rendering adapters

**Dependencies**: PixiJS types, sceneTypes
**Used By**: All other logic modules

#### sceneTypes.ts
**Purpose**: Configuration schema for scenes, layers, and effects

**Key Exports**:
- `LogicConfig`: Top-level scene configuration with layers and image registry
- `LayerConfig`: Individual layer configuration (position, scale, animations, effects)
- `ClockConfig`: Clock-driven animation configuration
- `ImageRef`: Reference to images (URL or registry ID)

**Dependencies**: None
**Used By**: All configuration-consuming modules

### Utilities

#### LogicCapability.ts
**Purpose**: Detects rendering capabilities and chooses appropriate backend

**Key Exports**:
- `isWebGLAvailable()`: Checks for WebGL support
- `detectRenderer(mode)`: Auto-detects or forces renderer choice ("pixi" | "dom")
- `RendererMode`: Type for renderer selection

**Dependencies**: None (browser APIs only)
**Used By**: LogicRenderer, rendering decision logic

#### LogicMath.ts
**Purpose**: Shared mathematical utilities for the pipeline

**Key Exports**:
- `toRad(deg)` / `toDeg(rad)`: Angle conversions
- `clamp(n, min, max)` / `clamp01(n)`: Value clamping
- `normDeg(deg)`: Normalize degrees to 0-360 range
- `clampRpm60(v)`: Clamp RPM values to 0-60 range

**Dependencies**: None
**Used By**: All animation and positioning logic

#### LogicTicker.ts
**Purpose**: Lightweight RAF-based ticker for animation loops

**Key Exports**:
- `createRafTicker()`: Creates a requestAnimationFrame-based ticker
- `RafTicker`: Interface with add/remove/start/stop/dispose methods

**Dependencies**: None (browser APIs only)
**Used By**: Not currently integrated, available for future use

### Layer Management

#### LogicLoaderBasic.ts
**Purpose**: Basic layer positioning, scaling, and z-index management

**Key Exports**:
- `logicApplyBasicTransform(app, sprite, cfg)`: Applies position, scale, rotation, z-index
- `logicZIndexFor(cfg)`: Extracts numeric z-index from layer ID

**Dependencies**: PixiJS, LogicMath, Stage2048
**Used By**: LayerCreator, all layer management modules

#### LayerCreator.ts
**Purpose**: Main orchestrator for building scenes from configuration

**Key Exports**:
- `createLayerCreatorManager()`: Factory for layer creation manager
- `LayerCreatorManager`: Interface managing the entire layer lifecycle
- Asset preloading, sprite creation, manager coordination

**Key Methods**:
- `init(app, cfg)`: Build complete scene from config
- `tick(elapsed)`: Update all animations
- `recompute()`: Handle resize events
- `dispose()`: Clean up resources

**Dependencies**: PixiJS, all layer managers (Spin, Clock, Orbit, Effect)
**Used By**: logicLoader.ts

#### LayerSpin.ts / LayerClock.ts / LayerOrbit.ts / LayerEffect.ts
**Purpose**: Specialized managers for different animation types

**Layer Spin**: RPM-based rotation animation
**Layer Clock**: Time-driven animations (hours/minutes/seconds hands)
**Layer Orbit**: Circular orbital motion around centers
**Layer Effect**: Visual effects (fade, pulse, tilt, glow, bloom, etc.)

**Pattern**: Each provides:
- `create{Type}Manager()`: Factory function
- `init(app, built)`: Initialize with built layers
- `tick(elapsed)`: Update animations
- `dispose()`: Cleanup

### Effects System

#### LogicLoaderEffects.ts
**Purpose**: Standard effects implementation (fade, pulse, tilt)

**Key Exports**:
- `buildEffects(app, built)`: Creates effect system for layers
- Normalization functions for effect specifications
- Pointer tracking for tilt effects
- Easing functions (linear, sineInOut)

**Effect Types**:
- **Fade**: Alpha transitions with ping-pong looping
- **Pulse**: Scale or alpha oscillation
- **Tilt**: Pointer/device/time-based rotation offsets

**Dependencies**: PixiJS, LogicCapability
**Used By**: LayerCreator (legacy), LayerEffect (current)

#### LogicLoaderEffectsAdvanced.ts
**Purpose**: Advanced effects requiring WebGL (glow, bloom, distort, shockwave)

**Key Exports**:
- `buildEffectsAdvanced(app, built)`: Advanced effects system
- Hardware capability checking
- Aura sprite creation for glow/bloom
- Distortion and shockwave animations

**Effect Types**:
- **Glow**: Colored aura sprites with additive blending
- **Bloom**: Additive bloom effect
- **Distort**: Position jitter animation
- **Shockwave**: Scale waves with optional fade

**Dependencies**: PixiJS, LogicCapability
**Used By**: LayerEffect

### Compatibility & Integration

#### LogicLoaderCompat.ts
**Purpose**: Compatibility wrapper for gradual migration

**Key Exports**:
- Re-exports `buildSceneFromLogic` from logicLoader
- Maintains backward compatibility during refactoring

**Dependencies**: logicLoader
**Used By**: Legacy code during migration

#### LogicLoaderHub.ts
**Purpose**: Hub scaffold for processor orchestration (Phase 1)

**Key Exports**:
- `buildSceneFromLogicHub(app, cfg)`: Future orchestration hub
- Currently passes through to current implementation

**Dependencies**: logicLoader (current implementation)
**Used By**: Future refactoring target

#### logicLoader.ts
**Purpose**: Main entry point for scene building

**Key Exports**:
- `buildSceneFromLogic(app, cfg)`: Primary API for scene creation
- Type re-exports for backward compatibility

**Dependencies**: LayerCreator
**Used By**: All scene creation code, rendering adapters

### Rendering Backends

#### LogicRendererPixi.ts
**Purpose**: PixiJS rendering adapter

**Key Exports**:
- `mountPixi(root, cfg, opts)`: Mount PixiJS scene in DOM element
- `PixiAdapterHandle`: Handle for cleanup
- Configuration for DPR, resize, anti-aliasing

**Dependencies**: PixiJS, logicLoader
**Used By**: LogicRenderer.tsx

#### LogicRenderer.tsx
**Purpose**: React component wrapper for renderers

**Key Exports**:
- `LogicRenderer`: React component with props for config and renderer choice
- Async mounting with cleanup handling
- Fallback to PixiJS if DOM renderer not implemented

**Dependencies**: React, LogicRendererPixi
**Used By**: React applications

#### LogicStage.tsx
**Purpose**: PixiJS stage component using Stage2048 module

**Key Exports**:
- `LogicStage`: React component for full-stage PixiJS rendering
- Integration with Stage2048 (2048×2048 canvas)
- Automatic scene building from LogicConfig.json

**Dependencies**: React, Stage2048, logicLoader, LogicConfig
**Used By**: React applications requiring full-stage rendering

#### LogicStageDom.tsx
**Purpose**: DOM-based stage implementation

**Key Exports**:
- `LogicStageDom`: React component for DOM-based rendering
- Complete animation system using HTML img elements
- Manual animation loop with requestAnimationFrame

**Features**:
- All animation types (spin, orbit, clock, effects)
- Pointer tracking for tilt effects
- Resize handling
- Time-based clock animations

**Dependencies**: React, sceneTypes, LogicMath, LayerOrbit, LayerEffect
**Used By**: React applications preferring DOM rendering

## Pipeline Flow

### Scene Creation Flow

1. **Configuration Loading**: LogicConfig loaded from JSON
2. **Asset Resolution**: Image URLs resolved from registry
3. **Layer Creation**: Sprites created and positioned
4. **Manager Initialization**: Animation managers initialized
5. **Effect Setup**: Effect processors configured
6. **Rendering**: Scene added to rendering backend

### Animation Loop Flow

1. **Ticker Update**: RAF or app ticker provides delta time
2. **Basic Transforms**: Position, scale, rotation updates
3. **Spin Animation**: RPM-based rotation
4. **Orbit Animation**: Circular motion calculations
5. **Clock Animation**: Time-driven overrides
6. **Effect Processing**: Visual effects applied
7. **Render**: Backend renders updated scene

### Manager Coordination

The LayerCreator orchestrates multiple specialized managers:

```
LayerCreator
├── LayerSpin (RPM rotation)
├── LayerClock (time-based animation)
├── LayerOrbit (circular motion)
└── LayerEffect (visual effects)
```

Each manager:
- Initializes with built layers
- Filters for relevant configurations
- Updates during tick cycle
- Handles resize events
- Cleans up on disposal

## Key Design Patterns

### Factory Pattern
Most components use factory functions (`create{Component}Manager()`) for initialization.

### Manager Pattern
Animation logic is separated into specialized managers with common interfaces.

### Adapter Pattern
Rendering backends implement common interfaces for different technologies.

### Strategy Pattern
Effects system supports multiple effect types with pluggable implementations.

### Observer Pattern
Resize and pointer events are observed by relevant managers.

## Dependencies Graph

```
sceneTypes ← LogicTypes ← All Modules
LogicMath ← All Animation Modules
LogicCapability ← Renderer Selection
LayerCreator ← logicLoader ← Rendering Adapters
Layer{Spin,Clock,Orbit,Effect} ← LayerCreator
LogicRenderer ← Stage Components
```

## Performance Considerations

### Asset Loading
- Parallel asset preloading in LayerCreator
- Texture caching via PixiJS Assets

### Animation Optimization
- Conditional ticker addition (only when animations present)
- Manager filtering (only process relevant layers)
- Effect capability detection (hardware-based)

### Memory Management
- Proper cleanup in dispose methods
- Event listener removal
- Sprite destruction for effects

### Rendering Performance
- Z-index based sorting
- additive blending for effects
- Hardware acceleration detection

## Configuration Schema

### Layer Configuration
```typescript
LayerConfig {
  id: string
  imageRef: ImageRef
  position: { xPct, yPct }
  scale?: { pct }
  angleDeg?: number
  spinRPM?: number
  orbitRPM?: number
  clock?: ClockConfig
  effects?: EffectSpec[]
}
```

### Effect Types
- **Basic**: fade, pulse, tilt
- **Advanced**: glow, bloom, distort, shockwave

### Clock Configuration
- Time sources: device, UTC, server
- Hand types: second, minute, hour
- Smooth vs stepped animation
- 12/24 hour format support

## Error Handling

### Asset Loading
- Graceful fallback for missing images
- Warning logs for failed loads
- Continued operation with partial assets

### Hardware Capabilities
- Feature detection for WebGL
- Advanced effects disabled on limited hardware
- Automatic fallback to basic effects

### Event Handling
- Try-catch blocks around event listener operations
- Graceful degradation for unsupported events

## Future Considerations

### LogicLoaderHub Evolution
Currently a passthrough, designed to become the main orchestrator for:
- Processor plugin system
- Advanced scheduling
- Performance monitoring

### Effect System Expansion
- Real bloom filter implementation
- Particle system integration
- Shader-based effects

### Renderer Backends
- WebGPU renderer support
- Canvas 2D fallback implementation
- Server-side rendering support

## Migration Guide

### From Legacy Effects
- Old LogicLoaderEffects → LayerEffect manager
- Old LogicLoaderEffectsAdvanced → Integrated in LayerEffect
- Unified effect processing pipeline

### Architecture Evolution
- Individual processors → Manager pattern
- Direct DOM manipulation → Adapter pattern
- Monolithic logic → Modular managers