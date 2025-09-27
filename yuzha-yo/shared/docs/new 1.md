# 🎯 Unified Layer System - Simple Integration Plan (Android Optimized)

## 🚀 Core Decision: Best of All Three Worlds

### **Remove Complexity:**
❌ **Pixi.js dependency** (Launcher) - Three.js is better for Android WebView  
❌ **Dual rendering abstraction** (complex engine switching)  
❌ **Stage size inconsistencies** (1024 vs 2048 vs flexible) → **Fixed 1024×1024**
❌ **Multiple coordinate conventions** (confusing transformations) → **Single percentage system**

### **Keep Best Features:**

#### **From Launcher (Proven & Stable):**
✅ **Percentage positioning** (`xPct`, `yPct`) - perfect responsive design  
✅ **React integration patterns** - mature component lifecycle  
✅ **CSS transform approach** - hardware accelerated, stable  
✅ **1024×1024 stage size** - proven Android compatibility  
✅ **Gesture system** - works great on mid-low Android devices

#### **From Upgraded (Professional & Powerful):**
✅ **Three.js rendering** - better WebGL performance than Pixi.js  
✅ **Device intelligence** - crucial Android performance optimization  
✅ **Modular architecture** - cleaner, maintainable code structure  

#### **From Variant (Pure & Flexible):**
✅ **Pure functional logic** - deterministic, testable behaviors  
✅ **Configuration-driven** - JSON config with TypeScript safety  
✅ **Pipeline processing** - composable effect system  
✅ **Time-precise animations** - smooth cross-device timing  

---



# 🎯 Unified Layer System - Simple Integration Plan (Following AI Guidelines)

## 📁 **Corrected File Structure (Flat + PascalCase + Naming Patterns)**

```
unified-system/ (flat structure - no subfolders)
├── Logic1_UnifiedEngine.ts              // Main engine coordination
├── Logic2_CoordinateSystem.ts           // Launcher's xPct/yPct system  
├── Logic3_ThreeRenderer.ts              // Three.js rendering
├── Logic4_DeviceDetection.ts            // Android tier detection
├── Logic5_BasicTransform.ts             // Pure functions for basic transforms
├── Logic6_SpinBehavior.ts               // Rotation logic from all 3 systems
├── Logic7_ClockBehavior.ts              // Time-based behaviors
├── Logic8_EffectProcessor.ts            // Simple effects (fade, pulse)
├── Logic9_PipelineProcessor.ts          // Variant's pure pipeline approach
├── UnifiedLayerScreen.tsx               // Main React component
├── UnifiedLayerConfig.ts                // Configuration types & presets
├── UnifiedLayerGesture.ts               // Gesture handling (Launcher patterns)
├── UnifiedLayerTypes.ts                 // All type definitions
└── UnifiedLayerUtils.ts                 // Helper functions
```

## 🔧 **Corrected Implementation Following Guidelines**

### **Logic1_UnifiedEngine.ts** (Main Engine)
```typescript
// IMPORT SECTION
import { Logic2_CoordinateSystem } from './Logic2_CoordinateSystem';
import { Logic3_ThreeRenderer } from './Logic3_ThreeRenderer';
import { Logic4_DeviceDetection } from './Logic4_DeviceDetection';
import { Logic9_PipelineProcessor } from './Logic9_PipelineProcessor';

// STYLE SECTION (unused)

// STATE SECTION
interface UnifiedEngineState {
  mounted: boolean;
  deviceTier: 'low' | 'mid' | 'high';
  renderer: Logic3_ThreeRenderer | null;
  coordinates: Logic2_CoordinateSystem | null;
}

// LOGIC SECTION
export class Logic1_UnifiedEngine {
  private state: UnifiedEngineState;
  private processor: Logic9_PipelineProcessor;
  
  constructor() {
    this.state = {
      mounted: false,
      deviceTier: Logic4_DeviceDetection.detectAndroidTier(),
      renderer: null,
      coordinates: null
    };
    this.processor = new Logic9_PipelineProcessor();
  }
  
  mount(container: HTMLElement): void {
    this.state.coordinates = new Logic2_CoordinateSystem();
    this.state.renderer = new Logic3_ThreeRenderer(this.state.deviceTier);
    this.state.mounted = true;
  }
}

// UI SECTION (unused)

// EFFECT SECTION (unused)

// EXPORT SECTION
export default Logic1_UnifiedEngine;
```

### **Logic2_CoordinateSystem.ts** (Launcher's Proven System)
```typescript
// IMPORT SECTION
import type { Vec2, StageTransform } from './UnifiedLayerTypes';

// STYLE SECTION (unused)

// STATE SECTION
const STAGE_CONFIG = {
  WIDTH: 1024,  // Launcher's proven Android size
  HEIGHT: 1024
} as const;

// LOGIC SECTION
export class Logic2_CoordinateSystem {
  // Launcher's proven percentage positioning
  percentageToPixels(xPct: number, yPct: number): Vec2 {
    return {
      x: (xPct / 100) * STAGE_CONFIG.WIDTH,
      y: (yPct / 100) * STAGE_CONFIG.HEIGHT
    };
  }
  
  // Launcher's CSS cover transform
  calculateStageTransform(viewportWidth: number, viewportHeight: number): StageTransform {
    const scaleX = viewportWidth / STAGE_CONFIG.WIDTH;
    const scaleY = viewportHeight / STAGE_CONFIG.HEIGHT;
    const scale = Math.max(scaleX, scaleY);
    
    return {
      scale,
      offsetX: (viewportWidth - STAGE_CONFIG.WIDTH * scale) / 2,
      offsetY: (viewportHeight - STAGE_CONFIG.HEIGHT * scale) / 2,
    };
  }
  
  // Upgraded's Three.js world conversion
  stageToWorld(stageX: number, stageY: number): [number, number] {
    const worldX = stageX - STAGE_CONFIG.WIDTH / 2;
    const worldY = -(stageY - STAGE_CONFIG.HEIGHT / 2);
    return [worldX, worldY];
  }
}

// UI SECTION (unused)

// EFFECT SECTION (unused)

// EXPORT SECTION
export default Logic2_CoordinateSystem;
```

### **Logic5_BasicTransform.ts** (Pure Functions - Variant Approach)
```typescript
// IMPORT SECTION
import type { BasicConfig, BasicState, Vec2 } from './UnifiedLayerTypes';

// STYLE SECTION (unused)

// STATE SECTION
const TRANSFORM_DEFAULTS = {
  OPACITY: 1,
  SCALE: 100,
  ANGLE: 0,
  VISIBLE: true
} as const;

// LOGIC SECTION
export function computeBasicTransformFromPercentage(
  config: BasicConfig, 
  canvasSize: Vec2
): BasicState {
  // Launcher's percentage positioning logic
  const position = {
    x: (config.position.xPct / 100) * canvasSize.x,
    y: (config.position.yPct / 100) * canvasSize.y
  };
  
  // Variant's comprehensive state building
  const scale = (config.scale?.pct ?? TRANSFORM_DEFAULTS.SCALE) / 100;
  const angle = config.angle?.deg ?? TRANSFORM_DEFAULTS.ANGLE;
  const opacity = config.opacity ?? TRANSFORM_DEFAULTS.OPACITY;
  const visible = config.visible ?? TRANSFORM_DEFAULTS.VISIBLE;
  
  return {
    position,
    scale,
    angle: normalizeAngle360(angle),
    opacity,
    visible
  };
}

export function normalizeAngle360(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

// UI SECTION (unused)

// EFFECT SECTION (unused)

// EXPORT SECTION
export { computeBasicTransformFromPercentage as default };
```

### **UnifiedLayerScreen.tsx** (React Component - Launcher Patterns)
```typescript
// IMPORT SECTION
import React, { useState, useEffect, useRef } from 'react';
import { Logic1_UnifiedEngine } from './Logic1_UnifiedEngine';
import { UnifiedLayerGesture } from './UnifiedLayerGesture';
import type { UnifiedLayerConfig } from './UnifiedLayerConfig';

// STYLE SECTION (unused)

// STATE SECTION
interface LayerScreenState {
  engine: Logic1_UnifiedEngine | null;
  mounted: boolean;
}

// LOGIC SECTION
function useUnifiedEngine(container: HTMLDivElement | null): LayerScreenState {
  const [state, setState] = useState<LayerScreenState>({
    engine: null,
    mounted: false
  });
  
  useEffect(() => {
    if (!container) return;
    
    const engine = new Logic1_UnifiedEngine();
    engine.mount(container);
    
    setState({
      engine,
      mounted: true
    });
    
    return () => {
      engine.dispose();
      setState({ engine: null, mounted: false });
    };
  }, [container]);
  
  return state;
}

function useAnimationFrame(callback: () => void): void {
  useEffect(() => {
    let animationId: number;
    
    const animate = () => {
      callback();
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [callback]);
}

// UI SECTION
export function UnifiedLayerScreen({ config }: { config: UnifiedLayerConfig[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { engine, mounted } = useUnifiedEngine(containerRef.current);
  const gesture = UnifiedLayerGesture.useGesture(containerRef);
  
  useAnimationFrame(() => {
    if (engine && mounted && config.length > 0) {
      engine.processAndRender(config);
    }
  });
  
  return (
    <div className="unified-layer-screen absolute inset-0 w-full h-full overflow-hidden">
      <div 
        ref={containerRef} 
        className="w-full h-full"
        data-testid="unified-layer-container"
      />
      <div 
        className="absolute inset-0 pointer-events-none"
        data-testid="gesture-overlay"
      >
        {gesture.isActive && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded">
            Gesture Active: {gesture.type}
          </div>
        )}
      </div>
    </div>
  );
}

// EFFECT SECTION (unused)

// EXPORT SECTION
export default UnifiedLayerScreen;
```

### **UnifiedLayerConfig.ts** (Configuration System)
```typescript
// IMPORT SECTION
import type { Vec2 } from './UnifiedLayerTypes';

// STYLE SECTION (unused)

// STATE SECTION
const CONFIG_VERSION = 1;

const SIMPLE_PRESETS = {
  CLOCK_SECOND: {
    position: { xPct: 50, yPct: 50 },
    scale: { pct: 100 },
    behaviors: { 
      clock: { enable: true, imageSpin: "sec", timezone: "local" } 
    }
  },
  SPINNING_LOGO: {
    position: { xPct: 50, yPct: 50 },
    scale: { pct: 80 },
    behaviors: { 
      spin: { enable: true, speedDegPerSec: 30, direction: "cw" } 
    }
  },
  PULSING_BUTTON: {
    position: { xPct: 80, yPct: 20 },
    scale: { pct: 60 },
    behaviors: { 
      effects: [{ type: "pulse", intensity: 0.1 }] 
    }
  }
} as const;

// LOGIC SECTION
export interface UnifiedLayerConfig {
  id: string;
  // Launcher's percentage positioning
  position: { xPct: number; yPct: number };
  scale: { pct: number };
  angle: { deg: number };
  opacity?: number;
  visible?: boolean;
  
  // Variant's behavior system
  behaviors?: {
    spin?: SpinBehaviorConfig;
    clock?: ClockBehaviorConfig;
    effects?: EffectConfig[];
  };
  
  // Asset information
  asset: {
    url: string;
    anchor?: Vec2;
  };
}

export interface SpinBehaviorConfig {
  enable: boolean;
  speedDegPerSec: number;
  direction: 'cw' | 'ccw';
  startDelayMs?: number;
  offsetDeg?: number;
}

export interface ClockBehaviorConfig {
  enable: boolean;
  timezone: string;
  imageSpin: 'sec' | 'min' | 'hour';
  tickMode?: 'smooth' | 'discrete';
}

export interface EffectConfig {
  type: 'fade' | 'pulse';
  intensity: number;
  durationMs?: number;
}

export function createConfigFromPreset(presetName: keyof typeof SIMPLE_PRESETS): Partial<UnifiedLayerConfig> {
  return SIMPLE_PRESETS[presetName];
}

export function validateConfig(config: unknown): config is UnifiedLayerConfig {
  // Simple validation logic
  const cfg = config as UnifiedLayerConfig;
  return !!(cfg.id && cfg.position && cfg.asset?.url);
}

// UI SECTION (unused)

// EFFECT SECTION (unused)

// EXPORT SECTION
export { SIMPLE_PRESETS, CONFIG_VERSION };
export default UnifiedLayerConfig;
```

## 🎯 **Android Mid-Low End Optimization**

### **Fixed Configuration for Simplicity:**
```typescript
const ANDROID_OPTIMIZED_SETTINGS = {
  // Fixed stage size - no adaptation complexity
  STAGE_SIZE: 1024,              // Launcher's proven size
  
  // Conservative quality settings
  DEFAULT_DPR: 1.0,              // No high-DPI complexity
  ANTIALIAS: false,              // Performance over quality
  SHADOWS: false,                // Too expensive for low-end
  MAX_OBJECTS: 100,              // Keep scenes simple
  
  // Simple device tiers
  DEVICE_TIERS: {
    'low': { dpr: 1.0, maxObjects: 50 },
    'mid': { dpr: 1.0, maxObjects: 100 },    // Still conservative
    'high': { dpr: 1.25, maxObjects: 150 }   // Not too aggressive
  }
}
```

### **Simple Device Detection:**
```typescript
// From Upgraded - but simplified for Android focus
function detectAndroidTier(): 'low' | 'mid' | 'high' {
  const memory = (performance as any).memory?.jsHeapSizeLimit || 50000000;
  const isOldAndroid = /Android [1-6]/.test(navigator.userAgent);
  
  if (isOldAndroid || memory < 100000000) return 'low';
  if (memory < 500000000) return 'mid';
  return 'high';
}
```

---

## 🔧 **Core Implementation**

### **1. Simple Coordinate System (Launcher's Proven Approach)**
```typescript
// Keep Launcher's simple, proven percentage system
class SimpleCoordinates {
  private readonly STAGE_SIZE = 1024;  // Fixed - no complexity
  
  // Launcher's proven percentage positioning
  percentageToPixels(xPct: number, yPct: number): Vec2 {
    return {
      x: (xPct / 100) * this.STAGE_SIZE,
      y: (yPct / 100) * this.STAGE_SIZE
    };
  }
  
  // Simple CSS cover transform - Launcher's approach
  calculateStageTransform(viewportWidth: number, viewportHeight: number) {
    const scale = Math.max(
      viewportWidth / this.STAGE_SIZE,
      viewportHeight / this.STAGE_SIZE
    );
    
    return {
      scale,
      offsetX: (viewportWidth - this.STAGE_SIZE * scale) / 2,
      offsetY: (viewportHeight - this.STAGE_SIZE * scale) / 2,
    };
  }
  
  // Basic Three.js conversion - from Upgraded
  stageToWorld(stageX: number, stageY: number): [number, number] {
    const worldX = stageX - this.STAGE_SIZE / 2;
    const worldY = -(stageY - this.STAGE_SIZE / 2);
    return [worldX, worldY];
  }
}
```

### **2. Pure Logic Pipeline (Variant's Clean Approach)**
```typescript
// Variant's pure functions + Launcher's percentage system
interface SimpleLayerConfig {
  // Keep Launcher's simple positioning
  position: { xPct: number; yPct: number };
  scale: { pct: number };
  angle: { deg: number };
  
  // Variant's behavior config - but simplified
  behaviors: {
    spin?: { enable: boolean; speedDegPerSec: number; direction: 'cw' | 'ccw' };
    clock?: { enable: boolean; timezone: string; imageSpin: 'sec' | 'min' | 'hour' };
    effects?: Array<{ type: 'fade' | 'pulse'; intensity: number }>;  // Simple effects only
  };
}

// Pure functional processing - Variant approach
function processSimpleLayer(config: SimpleLayerConfig, timeMs: number): RenderableLayer {
  // 1) Basic positioning - Launcher's percentage system
  const basic = computeBasicFromPercentage(config);
  
  // 2) Spin logic - merged from all 3 systems
  const spinAngle = config.behaviors.spin?.enable 
    ? computeSpinAngle(config.behaviors.spin, timeMs)
    : null;
    
  // 3) Clock logic - Variant + Launcher
  const clockAngle = config.behaviors.clock?.enable
    ? computeClockAngle(config.behaviors.clock, timeMs)
    : null;
    
  // 4) Priority resolution - Variant's clean approach
  const finalAngle = clockAngle ?? spinAngle ?? basic.angle;
  
  // 5) Simple effects - basic only
  const effects = computeSimpleEffects(config.behaviors.effects || [], timeMs);
  
  return {
    position: basic.position,
    scale: basic.scale * effects.scaleMultiplier,
    rotation: finalAngle,
    opacity: basic.opacity * effects.opacityMultiplier
  };
}
```

### **3. Simple Three.js Renderer (Upgraded's Core)**
```typescript
// Upgraded's Three.js but simplified for Android
class SimpleRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  
  constructor(deviceTier: 'low' | 'mid' | 'high') {
    // Conservative settings for Android
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,              // Always false for performance
      alpha: true,
      powerPreference: "default",    // Don't force high-performance
      preserveDrawingBuffer: false
    });
    
    // Fixed 1024×1024 - no complexity
    this.renderer.setSize(1024, 1024);
    this.renderer.setPixelRatio(deviceTier === 'high' ? 1.25 : 1.0);
  }
  
  createSimpleObject(renderable: RenderableLayer): THREE.Mesh {
    // Basic mesh creation - no fancy features
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: this.loadTexture(renderable.imageUrl),
      transparent: true,
      alphaTest: 0.01  // Performance optimization
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Apply transforms
    const [worldX, worldY] = this.coordinates.stageToWorld(
      renderable.position.x, 
      renderable.position.y
    );
    
    mesh.position.set(worldX, worldY, 0);
    mesh.scale.set(renderable.scale, renderable.scale, 1);
    mesh.rotation.z = (renderable.rotation * Math.PI) / 180;
    mesh.material.opacity = renderable.opacity;
    
    return mesh;
  }
}
```

### **4. Simple React Integration (Launcher's Proven Patterns)**
```typescript
// Keep Launcher's component structure - it works
export function SimpleLayerScreen({ config }: { config: SimpleLayerConfig[] }) {
  const [engine, setEngine] = useState<SimpleEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Simple initialization
    const deviceTier = detectAndroidTier();
    const newEngine = new SimpleEngine(deviceTier);
    newEngine.mount(containerRef.current);
    setEngine(newEngine);
    
    return () => newEngine.dispose();
  }, []);
  
  // Launcher's gesture system - proven to work on low-end Android
  const gesture = useSimpleGesture(containerRef);
  
  // Simple animation loop
  useAnimationFrame(() => {
    if (engine && config.length > 0) {
      const renderables = config.map(cfg => processSimpleLayer(cfg, performance.now()));
      engine.render(renderables);
    }
  });
  
  return (
    <div className="simple-layer-screen absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />
      {/* Keep Launcher's UI patterns */}
      <SimpleGestureOverlay gesture={gesture} />
    </div>
  );
}
```

---

## 📊 **Simple Configuration System**

### **Basic Config Structure:**
```json
{
  "version": 1,
  "layers": [
    {
      "id": "clock-hand",
      "position": { "xPct": 50, "yPct": 50 },
      "scale": { "pct": 100 },
      "angle": { "deg": 90 },
      "behaviors": {
        "clock": {
          "enable": true,
          "timezone": "Asia/Jakarta", 
          "imageSpin": "sec"
        }
      },
      "asset": {
        "url": "/assets/clock-hand.png"
      }
    }
  ]
}
```

### **Simple Presets for Common Use Cases:**
```typescript
const SIMPLE_PRESETS = {
  "clock-second": {
    position: { xPct: 50, yPct: 50 },
    behaviors: { clock: { enable: true, imageSpin: "sec" } }
  },
  "spinning-logo": {
    position: { xPct: 50, yPct: 50 },
    behaviors: { spin: { enable: true, speedDegPerSec: 30, direction: "cw" } }
  },
  "pulsing-button": {
    position: { xPct: 80, yPct: 20 },
    behaviors: { effects: [{ type: "pulse", intensity: 0.1 }] }
  }
}
```
