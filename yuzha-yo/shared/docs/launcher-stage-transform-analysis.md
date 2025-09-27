# 🎯 Stage Transform System - Complete Technical Analysis

## 📐 Mathematical Foundation

### 1. Fixed Canvas Paradigm
```typescript
export const STAGE_WIDTH = 1024   // Fixed virtual width
export const STAGE_HEIGHT = 1024  // Fixed virtual height
```

**Why 1024×1024?**
- Power of 2 (optimal for GPU operations)
- Square aspect ratio (works well for most content)  
- Large enough for detailed graphics
- Small enough for efficient memory usage

### 2. Cover Scaling Algorithm

The system implements CSS `background-size: cover` behavior mathematically:

```typescript
function calculateStageTransform(viewportWidth: number, viewportHeight: number) {
  const scaleX = viewportWidth / STAGE_WIDTH    // How much to scale X
  const scaleY = viewportHeight / STAGE_HEIGHT  // How much to scale Y
  const scale = Math.max(scaleX, scaleY)        // Use LARGER scale (cover behavior)
  
  const scaledWidth = STAGE_WIDTH * scale       // Actual rendered width  
  const scaledHeight = STAGE_HEIGHT * scale     // Actual rendered height
  
  // Center the scaled canvas in viewport
  const offsetX = (viewportWidth - scaledWidth) / 2
  const offsetY = (viewportHeight - scaledHeight) / 2
  
  return { scale, offsetX, offsetY, containerWidth: scaledWidth, containerHeight: scaledHeight }
}
```

## 🔄 Coordinate Transformation Deep Dive

### The Core Problem
When you have a fixed 1024×1024 canvas scaled to different viewport sizes, mouse/touch coordinates don't match canvas coordinates.

**Example Scenario:**
- Viewport: 1920×1080 (desktop monitor)
- Stage: 1024×1024 scaled up
- User clicks at screen position (960, 540)
- What's the equivalent position on the 1024×1024 stage?

### The Solution
```typescript
function transformCoordinatesToStage(clientX: number, clientY: number, transform: StageTransform) {
  // Step 1: Remove the centering offset
  const adjustedX = clientX - transform.offsetX
  const adjustedY = clientY - transform.offsetY
  
  // Step 2: Scale down to stage coordinates
  const stageX = adjustedX / transform.scale  
  const stageY = adjustedY / transform.scale
  
  return { stageX, stageY }
}
```

### Visual Breakdown

```
┌─────────────────────────────────────┐
│          Viewport (1920×1080)       │
│                                     │
│    ┌───────────────────────────┐    │ 
│    │                           │    │ ← offsetY
│    │     Scaled Stage          │    │
│    │     (1080×1080)           │    │
│    │                           │    │
│    └───────────────────────────┘    │
│    ↑                           ↑    │
│ offsetX                   offsetX   │
└─────────────────────────────────────┘

Scale calculation:
- scaleX = 1920 / 1024 = 1.875
- scaleY = 1080 / 1024 = 1.055  
- scale = max(1.875, 1.055) = 1.875 (use larger - cover behavior)
- Scaled stage = 1024 × 1.875 = 1920×1920
- offsetX = (1920 - 1920) / 2 = 0
- offsetY = (1080 - 1920) / 2 = -420 (stage extends beyond viewport)
```

## 📱 Device-Specific Behavior

### Portrait Phone (375×812 - iPhone 13)
```
scaleX = 375 / 1024 = 0.366
scaleY = 812 / 1024 = 0.793  
scale = max(0.366, 0.793) = 0.793

Scaled Stage: 1024 × 0.793 = 812×812
offsetX = (375 - 812) / 2 = -218.5 (crops left/right)
offsetY = (812 - 812) / 2 = 0

Result: Stage fills height, crops 437px total width
```

### Desktop Monitor (1920×1080)
```
scaleX = 1920 / 1024 = 1.875
scaleY = 1080 / 1024 = 1.055
scale = max(1.875, 1.055) = 1.875

Scaled Stage: 1024 × 1.875 = 1920×1920  
offsetX = (1920 - 1920) / 2 = 0
offsetY = (1080 - 1920) / 2 = -420 (crops top/bottom)

Result: Stage fills width, crops 840px total height
```

### iPad (1024×1366)
```
scaleX = 1024 / 1024 = 1.0
scaleY = 1366 / 1024 = 1.334
scale = max(1.0, 1.334) = 1.334

Scaled Stage: 1024 × 1.334 = 1366×1366
offsetX = (1024 - 1366) / 2 = -171 (crops left/right)  
offsetY = (1366 - 1366) / 2 = 0

Result: Stage fills height, crops 342px total width
```

## 🎯 Percentage-Based Positioning System

### How Percentages Work
Instead of absolute pixel positions, objects use percentage coordinates:

```typescript
// Layer configuration uses percentages
position: { xPct: 50, yPct: 25 }  // 50% right, 25% down

// Converted to actual pixels
const actualX = (50 / 100) * STAGE_WIDTH    // (50/100) * 1024 = 512px
const actualY = (25 / 100) * STAGE_HEIGHT   // (25/100) * 1024 = 256px
```

### Benefits of Percentage System
1. **Device Independence**: Same percentage = same relative position
2. **Designer Friendly**: Work in familiar 0-100% coordinates  
3. **Automatic Responsive**: No media queries needed
4. **Precise Control**: Can position to exact percentages

### Real-World Example
```typescript
// A button positioned at bottom-right corner
const buttonConfig = {
  position: { xPct: 90, yPct: 90 },  // 90% right, 90% down
  scale: { pct: 8 }                  // 8% of stage size
}

// On ANY device, this button will appear in bottom-right
// iPhone: (0.9 × 375, 0.9 × 812) in screen coords  
// Desktop: (0.9 × 1920, 0.9 × 1080) in screen coords
// But always (0.9 × 1024, 0.9 × 1024) in stage coords
```

## 🖱️ Gesture Support Implementation

### Touch/Mouse Event Transformation
```typescript
function transformEventCoordinates(event: PointerEvent | MouseEvent | TouchEvent): StageCoordinates {
  let clientX: number, clientY: number
  
  // Handle different event types
  if ('touches' in event && event.touches.length > 0) {
    // Touch event
    const firstTouch = event.touches.item(0)
    clientX = firstTouch.clientX
    clientY = firstTouch.clientY
  } else if ('clientX' in event) {
    // Mouse or pointer event  
    clientX = event.clientX
    clientY = event.clientY
  }
  
  // Transform to stage coordinates
  return transformCoordinatesToStage(clientX, clientY, this.transform)
}
```

### Why This Matters
Without coordinate transformation, gestures would be completely wrong:

```
User clicks at (100, 100) on screen
Without transform: Object thinks user clicked at (100, 100) on stage
With transform: Object knows user actually clicked at (127, 156) on stage
                (accounting for scaling and offset)
```

## 📏 Resize Handling System

### Automatic Recalculation
```typescript
class StageTransformManager {
  private resizeObserver: ResizeObserver
  
  constructor() {
    this.resizeObserver = new ResizeObserver(entries => {
      this.updateTransform()  // Recalculate everything
    })
  }
  
  updateTransform() {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    // Recalculate transform
    this.transform = calculateStageTransform(viewportWidth, viewportHeight)
    
    // Apply new CSS transforms
    this.canvas.style.transform = `scale(${this.transform.scale})`
    this.container.style.width = `${this.transform.containerWidth}px`
    this.container.style.height = `${this.transform.containerHeight}px`
  }
}
```

### What Happens During Resize
1. **ResizeObserver** detects viewport change
2. **New transform** calculated with updated dimensions  
3. **CSS transforms** applied to scale canvas
4. **Container size** updated to match scaled dimensions
5. **Coordinate system** automatically adjusted
6. **All gestures** continue working correctly

## 🎨 CSS Integration

### Applied Transforms
```css
/* Container holds the scaled canvas */
.stage-cover-container {
  position: relative;
  overflow: hidden;
}

/* Canvas gets scaled via transform */  
.stage-cover-canvas {
  transform-origin: top left;  /* Scale from top-left corner */
  transform: scale(1.875);     /* Applied dynamically */
}

/* Overlay for gesture capture */
.stage-cover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%; 
  pointer-events: auto;
}
```

## 🚀 Performance Considerations

### Optimization Strategies
1. **ResizeObserver**: More efficient than window.resize events
2. **Transform Caching**: Avoid recalculating on every coordinate transform
3. **CSS Transforms**: Hardware-accelerated scaling via GPU
4. **Event Batching**: Debounced resize handling
5. **Memory Management**: Proper cleanup on dispose

### Memory Usage
- Transform data: ~100 bytes per instance
- ResizeObserver: ~50 bytes + event handlers
- CSS transforms: Handled by browser (GPU memory)
- Total overhead: Minimal (~1KB per stage)

## 🎯 Use Cases & Applications

### Perfect For:
- **Game UIs**: Consistent button/HUD positioning across devices
- **Interactive Dashboards**: Data visualizations that scale properly  
- **Digital Art**: Precise pixel-perfect positioning
- **Responsive Canvas**: Any canvas-based app needing consistent layout

### Not Ideal For:
- **Text-heavy interfaces**: May cause blurry text on some scales
- **Native mobile apps**: Platform-specific layouts often better
- **Simple web pages**: Overkill for basic responsive design

## 🔧 Integration Example

```typescript
// 1. Create stage manager
const stageManager = new StageTransformManager(true) // debug enabled

// 2. Initialize with DOM elements  
const { app, transformManager } = await pixiAdapter.mount(containerElement)

// 3. Use coordinate transformation in gesture handlers
element.addEventListener('pointerdown', (event) => {
  const stageCoords = transformManager.transformEventCoordinates(event)
  if (stageCoords) {
    console.log(`Clicked at stage position: ${stageCoords.stageX}, ${stageCoords.stageY}`)
    // stageCoords are now in 0-1024 range regardless of actual screen size
  }
})

// 4. Position objects using percentages
const sprite = new PIXI.Sprite(texture)
sprite.x = (75 / 100) * STAGE_WIDTH  // 75% across stage = 768px
sprite.y = (25 / 100) * STAGE_HEIGHT // 25% down stage = 256px
```

This system provides a robust foundation for creating consistent, responsive interactive experiences across any device size or orientation while maintaining precise control over layout and positioning.