🎯 End-to-End Unified Layer System Implementation Plan
📋 Overview: Complete Integration Strategy
This plan details the step-by-step implementation to create a unified layer system by merging the best features from Launcher (Pixi.js), Upgraded (Three.js), and Variant (Pure Functions) systems, following AI guidelines and flat file structure.

🔧 Phase 1: Unified Logic Foundation (Week 1-2)
1.1 Create LayerTypes.ts - Unified Type System
Location: shared/layer/LayerTypes.ts

Purpose: Single source of truth for all type definitions, merging concepts from all three systems.

// IMPORT SECTION
// (none - base types file)
// STYLE SECTION (unused)
// STATE SECTION
export const STAGE_WIDTH = 1024;  // Launcher proven size
export const STAGE_HEIGHT = 1024; // Android compatibility
// LOGIC SECTION
export type Vec2 = { x: number; y: number };
// Core positioning (Launcher percentage + Upgraded world + Variant pure)
export interface UnifiedPosition {
  xPct: number;  // Launcher: percentage positioning (0-100)
  yPct: number;  // Proven responsive design
}
// Unified layer configuration (Best of all 3)
export interface UnifiedLayerConfig {
  // Basic properties (Launcher + Variant)
  id: string;
  imageUrl: string;
  position: UnifiedPosition;
  scale: { pct: number };
  angle: { deg: number };
  zIndex: number;
  visible: boolean;
  opacity: number;
  
  // Behaviors (Variant pure functions)
  behaviors?: {
    spin?: SpinConfig;
    orbit?: OrbitConfig;
    clock?: ClockConfig;
    effects?: EffectConfig[];
  };
  
  // Device optimization (Upgraded intelligence)
  deviceSettings?: {
    tier?: 'auto' | 'low' | 'mid' | 'high';
    fallback?: Partial<UnifiedLayerConfig>;
  };
}
// Pure renderable output (Variant approach)
export interface LayerRenderable {
  id: string;
  imageUrl: string;
  positionPx: Vec2;
  scale: Vec2;
  finalAngleDeg: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  anchor01: Vec2;
  angleSource: 'clock' | 'spin' | 'manual';
}
// UI SECTION (unused)
// EFFECT SECTION (unused)
// EXPORT SECTION
export type { UnifiedLayerConfig, LayerRenderable, UnifiedPosition };
1.2 Create LayerLogicBasic.ts - Core Transform Logic
Location: shared/layer/LayerLogicBasic.ts

Purpose: Merge basic transform logic from all three systems.

// IMPORT SECTION
import type { Vec2, UnifiedPosition, LayerRenderable } from './LayerTypes';
// STYLE SECTION (unused)
// STATE SECTION
const DEFAULT_ANCHOR = { x: 0.5, y: 0.5 };
const DEFAULT_SCALE = { x: 1, y: 1 };
// LOGIC SECTION
export interface BasicConfig {
  enable: boolean;
  position: UnifiedPosition;
  scale: { pct: number };
  angle: { deg: number };
  opacity: number;
  imageUrl: string;
  zIndex: number;
  visible: boolean;
}
export interface BasicState {
  positionPx: Vec2;
  scale: Vec2;
  baseAngleDeg: number;
  opacity: number;
  anchor01: Vec2;
  imageUrl: string;
  zIndex: number;
  visible: boolean;
}
// Launcher: percentage to pixels (proven approach)
export function percentageToPixels(position: UnifiedPosition, canvasSize: Vec2): Vec2 {
  return {
    x: (position.xPct / 100) * canvasSize.x,
    y: (position.yPct / 100) * canvasSize.y
  };
}
// Variant: pure function approach
export function computeBasicState(cfg: BasicConfig, canvasSize: Vec2): BasicState {
  const positionPx = percentageToPixels(cfg.position, canvasSize);
  const scalePct = cfg.scale.pct / 100;
  
  return {
    positionPx,
    scale: { x: scalePct, y: scalePct },
    baseAngleDeg: normalize360(cfg.angle.deg),
    opacity: cfg.opacity,
    anchor01: DEFAULT_ANCHOR,
    imageUrl: cfg.imageUrl,
    zIndex: cfg.zIndex,
    visible: cfg.visible
  };
}
// Variant: angle normalization
export function normalize360(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}
// Variant: final angle resolution (Clock > Spin > Manual)
export function resolveFinalAngle(
  baseAngleDeg: number,
  overrides: { clockAngleDeg?: number | null; spinAngleDeg?: number | null }
): { angleDeg: number; source: 'clock' | 'spin' | 'manual' } {
  if (typeof overrides.clockAngleDeg === 'number') {
    return { angleDeg: normalize360(overrides.clockAngleDeg), source: 'clock' };
  }
  if (typeof overrides.spinAngleDeg === 'number') {
    return { angleDeg: normalize360(overrides.spinAngleDeg), source: 'spin' };
  }
  return { angleDeg: normalize360(baseAngleDeg), source: 'manual' };
}
// UI SECTION (unused)
// EFFECT SECTION (unused)
// EXPORT SECTION
export { computeBasicState, resolveFinalAngle, percentageToPixels, normalize360 };
1.3 Create LayerLogicSpin.ts - Rotation Behavior
Location: shared/layer/LayerLogicSpin.ts

Purpose: Merge spin logic from Launcher (RPM) + Upgraded (simple) + Variant (pure functions).

// IMPORT SECTION
import { normalize360 } from './LayerLogicBasic';
// STYLE SECTION (unused)
// STATE SECTION
export type SpinDirection = 'cw' | 'ccw';
// LOGIC SECTION
export interface SpinConfig {
  enable: boolean;
  speedDegPerSec?: number;  // Variant: degrees per second
  rpm?: number;             // Launcher: RPM support
  direction?: SpinDirection;
  offsetDeg?: number;
  epochMs?: number;
  startDelayMs?: number;
  durationMs?: number;
}
// Launcher: RPM to degrees per second
function rpmToDegreesPerSec(rpm: number): number {
  return rpm * 6; // 1 RPM = 6 degrees per second
}
// Upgraded: simple speed resolution
function resolveSpeedDps(cfg: SpinConfig): number {
  if (typeof cfg.speedDegPerSec === 'number' && isFinite(cfg.speedDegPerSec)) {
    return cfg.speedDegPerSec;
  }
  if (typeof cfg.rpm === 'number' && isFinite(cfg.rpm)) {
    return rpmToDegreesPerSec(cfg.rpm);
  }
  return 0;
}
// Variant: windowed motion check
function isWithinActiveWindow(cfg: SpinConfig, nowMs: number, epochMs: number): boolean {
  const delay = cfg.startDelayMs ?? 0;
  const dur = cfg.durationMs ?? Number.POSITIVE_INFINITY;
  const t = nowMs - epochMs;
  if (t < delay) return false;
  return t < (delay + dur);
}
// Variant: pure computation
export function getSpinAngleDeg(cfg: SpinConfig, options?: { nowMs?: number }): number | null {
  const nowMs = options?.nowMs ?? Date.now();
  const enabled = !!cfg.enable;
  const epoch = cfg.epochMs ?? 0;
  
  if (!enabled) return null;
  
  const dirSign = cfg.direction === 'ccw' ? -1 : 1;
  const speed = resolveSpeedDps(cfg) * dirSign;
  
  if (!isWithinActiveWindow(cfg, nowMs, epoch) || speed === 0) {
    return null;
  }
  
  const delay = cfg.startDelayMs ?? 0;
  const t = Math.max(0, nowMs - epoch - delay);
  const raw = speed * (t / 1000);
  const withOffset = raw + (cfg.offsetDeg ?? 0);
  
  return normalize360(withOffset);
}
// UI SECTION (unused)
// EFFECT SECTION (unused)
// EXPORT SECTION
export { getSpinAngleDeg };
export type { SpinConfig };
1.4 Create LayerLogicOrbit.ts, LayerLogicClock.ts, LayerLogicEffects.ts
Similar structure for each behavior module, following the same sectioned pattern.

🏗️ Phase 2: Unified System Architecture (Week 3-4)
2.1 Create LayerCoreCoordinates.ts - Coordinate System
Location: shared/layer/LayerCoreCoordinates.ts

Purpose: Merge coordinate systems from all three systems.

// IMPORT SECTION
import type { Vec2, UnifiedPosition } from './LayerTypes';
// STYLE SECTION (unused)
// STATE SECTION  
export const STAGE_WIDTH = 1024;   // Launcher: proven Android compatibility
export const STAGE_HEIGHT = 1024;
// LOGIC SECTION
export interface StageTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  containerWidth: number;
  containerHeight: number;
}
// Launcher: proven cover behavior
export function calculateStageTransform(viewportWidth: number, viewportHeight: number): StageTransform {
  const scaleX = viewportWidth / STAGE_WIDTH;
  const scaleY = viewportHeight / STAGE_HEIGHT;
  const scale = Math.max(scaleX, scaleY); // Cover behavior
  
  const scaledWidth = STAGE_WIDTH * scale;
  const scaledHeight = STAGE_HEIGHT * scale;
  
  return {
    scale,
    offsetX: (viewportWidth - scaledWidth) / 2,
    offsetY: (viewportHeight - scaledHeight) / 2,
    containerWidth: scaledWidth,
    containerHeight: scaledHeight
  };
}
// Upgraded: Three.js world coordinates
export function stageToWorld(stageX: number, stageY: number): [number, number] {
  const worldX = stageX - STAGE_WIDTH / 2;
  const worldY = -(stageY - STAGE_HEIGHT / 2);
  return [worldX, worldY];
}
// Launcher: proven percentage system
export function percentageToStage(position: UnifiedPosition): Vec2 {
  return {
    x: (position.xPct / 100) * STAGE_WIDTH,
    y: (position.yPct / 100) * STAGE_HEIGHT
  };
}
// Launcher: viewport to stage coordinates
export function transformCoordinatesToStage(
  clientX: number,
  clientY: number,
  transform: StageTransform
): Vec2 {
  return {
    x: (clientX - transform.offsetX) / transform.scale,
    y: (clientY - transform.offsetY) / transform.scale
  };
}
// UI SECTION (unused)
// EFFECT SECTION (unused)
// EXPORT SECTION
export { calculateStageTransform, stageToWorld, percentageToStage, transformCoordinatesToStage };
2.2 Create LayerCoreRenderer.ts - Three.js Renderer
Location: shared/layer/LayerCoreRenderer.ts

Purpose: Upgraded's Three.js approach with Launcher's coordinate integration.

2.3 Create LayerCoreDevice.ts - Device Intelligence
Location: shared/layer/LayerCoreDevice.ts

Purpose: Upgraded's device detection with Android optimization.

2.4 Create LayerCoreEngine.ts - Main Engine
Location: shared/layer/LayerCoreEngine.ts

Purpose: Upgraded's modular architecture coordinating all systems.

🔗 Phase 3: Connection Layer (Week 5)
3.1 Create LayerProcessor.ts - Pipeline Connector
Location: shared/layer/LayerProcessor.ts

Purpose: Connect all logic modules using Variant's pure pipeline approach.

// IMPORT SECTION
import type { UnifiedLayerConfig, LayerRenderable, Vec2 } from './LayerTypes';
import { computeBasicState, resolveFinalAngle } from './LayerLogicBasic';
import { getSpinAngleDeg } from './LayerLogicSpin';
import { computeOrbitState } from './LayerLogicOrbit';
import { getClockDrivenImageAngle } from './LayerLogicClock';
import { computeEffectState, applyEffectToRenderable } from './LayerLogicEffects';
// STYLE SECTION (unused)
// STATE SECTION (unused)
// LOGIC SECTION
export interface ProcessingContext {
  canvasSize: Vec2;
  timeMs: number;
  deviceTier?: 'low' | 'mid' | 'high';
}
// Variant: pure functional pipeline (Basic → Spin → Orbit → Clock → Effects)
export function processLayerFrame(
  config: UnifiedLayerConfig,
  context: ProcessingContext
): LayerRenderable {
  // 1) Basic state from percentage positioning
  const basicConfig = {
    enable: true,
    position: config.position,
    scale: config.scale,
    angle: config.angle,
    opacity: config.opacity,
    imageUrl: config.imageUrl,
    zIndex: config.zIndex,
    visible: config.visible
  };
  
  const basic = computeBasicState(basicConfig, context.canvasSize);
  
  // 2) Spin behavior (null if not active)
  const spinAngle = config.behaviors?.spin 
    ? getSpinAngleDeg(config.behaviors.spin, { nowMs: context.timeMs })
    : null;
  
  // 3) Orbit behavior (changes position + suggests orientation)
  const orbit = config.behaviors?.orbit
    ? computeOrbitState(config.behaviors.orbit, basic.positionPx, { 
        nowMs: context.timeMs, 
        spinAngleDeg: spinAngle 
      })
    : { positionPx: basic.positionPx, orientationDeg: null };
  
  // 4) Clock behavior (can inherit spin)
  const clockAngle = config.behaviors?.clock
    ? getClockDrivenImageAngle(config.behaviors.clock, { 
        inheritSpinDeg: spinAngle,
        nowMs: context.timeMs 
      })
    : null;
  
  // 5) Final angle resolution (Clock > Spin > Manual)
  const finalAngle = resolveFinalAngle(basic.baseAngleDeg, {
    clockAngleDeg: clockAngle ?? orbit.orientationDeg,
    spinAngleDeg: spinAngle
  });
  
  // 6) Effects processing
  const effects = config.behaviors?.effects?.length 
    ? computeEffectState(config.behaviors.effects, context.timeMs)
    : null;
  
  const finalState = effects
    ? applyEffectToRenderable({
        positionPx: orbit.positionPx,
        scale: basic.scale,
        opacity: basic.opacity,
        finalAngleDeg: finalAngle.angleDeg
      }, effects)
    : {
        positionPx: orbit.positionPx,
        scale: basic.scale,
        opacity: basic.opacity,
        finalAngleDeg: finalAngle.angleDeg
      };
  
  return {
    id: config.id,
    imageUrl: config.imageUrl,
    positionPx: finalState.positionPx,
    scale: finalState.scale,
    finalAngleDeg: finalState.finalAngleDeg,
    opacity: finalState.opacity,
    zIndex: config.zIndex,
    visible: config.visible,
    anchor01: basic.anchor01,
    angleSource: finalAngle.source
  };
}
// UI SECTION (unused)
// EFFECT SECTION (unused)
// EXPORT SECTION
export { processLayerFrame };
export type { ProcessingContext };
⚛️ Phase 4: React Integration (Week 6)
4.1 Create LayerReactScreen.tsx - Main Component
Location: shared/layer/LayerReactScreen.tsx

Purpose: Launcher's proven React patterns enhanced with unified system.

4.2 Create LayerReactHooks.ts - Custom Hooks
Location: shared/layer/LayerReactHooks.ts

Purpose: Launcher's gesture system + unified coordinate handling.

🔌 Phase 5: Yuzha Integration (Week 7)
5.1 Update yuzha/src/App.tsx
Purpose: Connect unified layer system to main application.

// IMPORT SECTION
import React from 'react';
import { LayerReactScreen } from '../shared/layer/LayerReactScreen';
import { UnifiedLayerConfig } from '../shared/layer/LayerTypes';
// STYLE SECTION (unused)
// STATE SECTION
const clockConfig: UnifiedLayerConfig = {
  id: 'main-clock',
  imageUrl: '/shared/Asset/CLOCKBG.png',
  position: { xPct: 50, yPct: 50 },
  scale: { pct: 100 },
  angle: { deg: 0 },
  zIndex: 10,
  visible: true,
  opacity: 1,
  behaviors: {
    clock: {
      enable: true,
      timezone: 'Asia/Jakarta',
      imageSpin: 'sec'
    },
    effects: [{
      type: 'pulse',
      scaleAmp: 0.05,
      freqHz: 0.8
    }]
  }
};
// LOGIC SECTION (unused)
// UI SECTION
export function App() {
  return (
    <div className="w-full h-screen bg-black">
      <LayerReactScreen 
        layers={[clockConfig]}
        deviceTier="auto"
      />
    </div>
  );
}
// EFFECT SECTION (unused)
// EXPORT SECTION
export default App;
5.2 Update yuzha/src/main.tsx
Purpose: Ensure proper mounting with unified system.

📦 Final File Structure
shared/layer/
├── LayerTypes.ts                    // Unified type definitions
├── LayerLogicBasic.ts              // Basic transform logic  
├── LayerLogicSpin.ts               // Rotation behavior
├── LayerLogicOrbit.ts              // Orbital motion
├── LayerLogicClock.ts              // Time-based behavior
├── LayerLogicEffects.ts            // Visual effects
├── LayerCoreCoordinates.ts         // Coordinate system
├── LayerCoreRenderer.ts            // Three.js renderer
├── LayerCoreDevice.ts              // Device intelligence
├── LayerCoreEngine.ts              // Main engine
├── LayerProcessor.ts               // Pipeline connector
├── LayerReactScreen.tsx            // React main component
├── LayerReactHooks.ts              // React hooks & gestures
└── index.ts                        // Barrel exports
yuzha/src/
├── App.tsx                         // Updated with unified layer
├── main.tsx                        // Updated mounting
└── launcher/ (legacy, optional)
✅ Implementation Checklist
Phase 1: Logic Foundation
 Create LayerTypes.ts with unified type system
 Create LayerLogicBasic.ts with percentage + pure functions
 Create LayerLogicSpin.ts with RPM + pure approach
 Create LayerLogicOrbit.ts with all orbit behaviors
 Create LayerLogicClock.ts with timezone support
 Create LayerLogicEffects.ts with composable effects
Phase 2: System Architecture
 Create LayerCoreCoordinates.ts with unified coordinate system
 Create LayerCoreRenderer.ts with Three.js + percentage positioning
 Create LayerCoreDevice.ts with Android optimization
 Create LayerCoreEngine.ts with modular architecture
Phase 3: Connection
 Create LayerProcessor.ts with pure pipeline
 Test individual logic modules
 Test full pipeline processing
 Performance testing on Android targets
Phase 4: React Integration
 Create LayerReactScreen.tsx with Launcher patterns
 Create LayerReactHooks.ts with gesture system
 Test React component integration
 Test gesture handling with unified coordinates
Phase 5: Yuzha Integration
 Update yuzha/src/App.tsx with unified layer
 Update yuzha/src/main.tsx for proper mounting
 Test complete end-to-end functionality
 Performance validation on target devices
Phase 6: Validation
 Test all AI guideline compliance (sectioned layout)
 Test flat file structure (no subfolders)
 Test Android compatibility across device tiers
 Test configuration system with JSON presets
 Final performance benchmarking
🎯 Success Criteria
✅ Single unified system replacing three separate implementations
✅ Android optimization with device tier detection
✅ Proven Launcher patterns (percentage positioning, React integration)
✅ Upgraded architecture (Three.js, modular design, device intelligence)
✅ Variant pure functions (deterministic, testable, configurable)
✅ AI guideline compliance (sectioned layout, flat structure)
✅ Yuzha integration (seamless connection to host application)
This plan creates a single, powerful layer system that combines the proven stability of Launcher, 
the professional architecture of Upgraded, 
and the pure functional elegance of Variant - 
all optimized for Android performance and following your AI guidelines.


Based on my plan, the final config preset for the unified system would be:

🎯 Complete UnifiedLayerConfig Structure
// Single layer configuration
interface UnifiedLayerConfig {
  // Core properties (merged from all 3 systems)
  id: string;
  imageUrl: string;
  position: { xPct: number; yPct: number };  // Launcher: percentage positioning
  scale: { pct: number };
  angle: { deg: number };
  zIndex: number;
  visible: boolean;
  opacity: number;
  
  // Behaviors (Variant: pure function approach)
  behaviors?: {
    spin?: {
      enable: boolean;
      speedDegPerSec?: number;  // Variant approach
      rpm?: number;             // Launcher support
      direction?: 'cw' | 'ccw';
      offsetDeg?: number;
      startDelayMs?: number;
      durationMs?: number;
    };
    
    orbit?: {
      enable: boolean;
      orbitCenter?: { x: number; y: number };
      radiusPx?: number;
      speedDegPerSec?: number;
      direction?: 'cw' | 'ccw';
      orientationMode?: 'inheritSpin' | 'radial-out' | 'tangent';
    };
    
    clock?: {
      enable: boolean;
      timezone?: string;
      imageSpin?: 'none' | 'true' | 'sec' | 'min' | 'hour';
      tickMode?: 'smooth' | 'tick';
    };
    
    effects?: Array<{
      type: 'fade' | 'pulse' | 'blink' | 'shake' | 'wiggle';
      enable?: boolean;
      freqHz?: number;
      scaleAmp?: number;
      opacityAmp?: number;
      mix?: number;
    }>;
  };
  
  // Device optimization (Upgraded: device intelligence)
  deviceSettings?: {
    tier?: 'auto' | 'low' | 'mid' | 'high';
    fallback?: Partial<UnifiedLayerConfig>;
  };
}
📋 Sample Complete Preset
// Example: Animated clock with full features
const fullClockPreset: UnifiedLayerConfig = {
  id: 'animated-clock',
  imageUrl: '/shared/Asset/CLOCKBG.png',
  position: { xPct: 50, yPct: 50 },    // Center screen (Launcher approach)
  scale: { pct: 100 },
  angle: { deg: 0 },
  zIndex: 10,
  visible: true,
  opacity: 1,
  
  behaviors: {
    // Variant: pure function approach
    spin: {
      enable: false  // Clock will control rotation
    },
    
    orbit: {
      enable: false  // Static center position
    },
    
    clock: {
      enable: true,
      timezone: 'Asia/Jakarta',
      imageSpin: 'sec',      // Second hand rotation
      tickMode: 'smooth'     // Smooth movement
    },
    
    effects: [
      {
        type: 'pulse',         // Breathing effect
        enable: true,
        freqHz: 0.8,
        scaleAmp: 0.05,
        mix: 1
      },
      {
        type: 'fade',          // Gentle fade in
        enable: true,
        from: 0,
        to: 1,
        durationMs: 1000,
        mix: 1
      }
    ]
  },
  
  // Upgraded: Android optimization
  deviceSettings: {
    tier: 'auto',
    fallback: {
      behaviors: {
        effects: []  // Disable effects on low-end devices
      }
    }
  }
};
// Example: Simple spinning gear
const spinningGearPreset: UnifiedLayerConfig = {
  id: 'gear-spinner',
  imageUrl: '/shared/Asset/GEAR1.png',
  position: { xPct: 25, yPct: 75 },    // Bottom left
  scale: { pct: 80 },
  angle: { deg: 0 },
  zIndex: 5,
  visible: true,
  opacity: 0.8,
  
  behaviors: {
    spin: {
      enable: true,
      rpm: 10,              // Launcher: RPM support
      direction: 'cw'
    }
  }
};
// Example: Orbital moon
const orbitingMoonPreset: UnifiedLayerConfig = {
  id: 'moon-orbit',
  imageUrl: '/shared/Asset/GEARMOON.png',
  position: { xPct: 70, yPct: 30 },    // Starting position
  scale: { pct: 60 },
  angle: { deg: 0 },
  zIndex: 15,
  visible: true,
  opacity: 1,
  
  behaviors: {
    orbit: {
      enable: true,
      orbitCenter: { x: 512, y: 512 },  // Center of 1024x1024 stage
      radiusPx: 200,
      speedDegPerSec: 45,
      direction: 'cw',
      orientationMode: 'tangent'         // Face forward along path
    },
    
    effects: [
      {
        type: 'pulse',
        enable: true,
        freqHz: 2,
        opacityAmp: 0.2,
        mix: 0.5
      }
    ]
  }
};
🎯 Key Features of Final Config
Launcher Integration: Percentage positioning (xPct, yPct) for responsive design
Upgraded Architecture: Device tier optimization and fallback configurations
Variant Purity: Pure function behaviors that are deterministic and testable
Android Optimized: Automatic quality adjustment based on device capabilities
Flat Structure: No subfolders, following AI guidelines
Sectioned Layout: All implementation files follow the required section pattern
The configuration is JSON-serializable for easy storage and TypeScript-validated for compile-time safety, 
giving you the best of both worlds from all three original systems.

shared/layer/
├── LayerTypes.ts                    // Unified type definitions
    LayerTypes.ts - from merge/upgraded/
    stage-transform.ts (interfaces) - from merge/Launcher/
    Layer.txt (type specs) - from merge/variant/

├── LayerLogicBasic.ts              // Basic transform logic  
    LogicLoaderBasic.ts - from merge/Launcher/
    LayerLogicBasic.ts - from merge/upgraded/
    LayerBasic.txt - from merge/variant/

├── LayerLogicSpin.ts               // Rotation behavior
    LogicLoaderSpin.ts - from merge/Launcher/
    LayerLogicSpin.ts - from merge/upgraded/
    LayerSpin.txt - from merge/variant/

├── LayerLogicOrbit.ts              // Orbital motion
    LogicLoaderOrbit.ts - from merge/Launcher/
    LayerLogicOrbit.ts - from merge/upgraded/
    LayerOrbit.txt - from merge/variant/

├── LayerLogicClock.ts              // Time-based behavior
    LogicLoaderClock.ts - from merge/Launcher/
    (clock logic) - from merge/upgraded/
    LayerClock.txt - from merge/variant/

├── LayerLogicEffects.ts            // Visual effects
    LogicLoaderEffects.ts - from merge/Launcher/
    LayerLogicFade.ts - from merge/upgraded/
    LayerLogicPulse.ts - from merge/upgraded/
    LayerEffect.txt - from merge/variant/

├── LayerCoreCoordinates.ts         // Coordinate system
    stage-transform.ts - from merge/Launcher/
    StagesLogicTransform.ts - from merge/upgraded/
    (coordinate logic) - from merge/variant/

├── LayerCoreRenderer.ts            // Three.js renderer
    LogicStage.tsx (rendering parts) - from merge/Launcher/
    StagesRenderer.ts - from merge/upgraded/
    (renderer-agnostic specs) - from merge/variant/

├── LayerCoreDevice.ts              // Device intelligence
    LogicCapability.ts - from merge/Launcher/
    StagesLogicDevice.ts - from merge/upgraded/
    StagesLogicPerformance.ts - from merge/upgraded/

├── LayerCoreEngine.ts              // Main engine
    LogicStage.tsx (engine parts) - from merge/Launcher/
    StagesEngine.ts - from merge/upgraded/
    StagesLogic.ts - from merge/upgraded/

├── LayerProcessor.ts               // Pipeline connector
    (pipeline logic) - from merge/Launcher/
    LayerPipeline.ts - from merge/upgraded/
    LayerProducer.ts - from merge/upgraded/
    Layer.txt (pipeline specs) - from merge/variant/

├── LayerReactScreen.tsx            // React main component
    LauncherScreen.tsx - from merge/Launcher/
    LogicStage.tsx - from merge/Launcher/

├── LayerReactHooks.ts              // React hooks & gestures
    LauncherBtnGesture.tsx - from merge/Launcher/
    LauncherBtn.tsx - from merge/Launcher/

└── index.ts                        // Barrel exports
    (export patterns) - from merge/Launcher/
    (export patterns) - from merge/upgraded/
    Layer.txt (export specs) - from merge/variant/