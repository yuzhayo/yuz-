The user wants a comprehensive implementation plan for creating a basic layer system that can display images from JSON configuration. This needs to be complete and detailed enough that a new AI agent could follow it without any prior knowledge.

Let me break down what they need:

List of result file names in shared/layer/ (no subfolders)
Reference files from rawcode
How to connect to yuzha through stages1
JSON file with preset
Step-by-step implementation
Success criteria
Mandatory contract
Test code with typecheck, eslint, prettier requirements
The user wants this to be a complete guide that doesn't require prior knowledge.

Let me create a comprehensive plan based on the patterns I've seen in the rawcode analysis and the current yuzha structure.

Complete Implementation Plan: Basic Layer System
Overview
Create a modular layer system that displays images from JSON configuration in yuzha's MainScreen using Three.js rendering.

Result Files Structure

shared/layer/
├── LayerBasicCore.ts           # Main pipeline engine
├── LayerBasicTypes.ts          # Type definitions  
├── LayerBasicAssets.ts         # Asset loading/resolution
├── LayerBasicTransform.ts      # Position/scale/rotation processing
├── LayerBasicRenderer.ts       # Three.js rendering
├── LayerBasicRegister.ts       # Plugin registration system
├── LayerBasicMath.ts           # Mathematical utilities
└── MainConfig.json             # Layer configuration preset


Reference Files from rawcode
LayerBasicCore.ts ← merge/rawcode/logicLoader.ts (lines 31-143)
LayerBasicTypes.ts ← merge/rawcode/sceneTypes.ts (lines 1-116)
LayerBasicAssets.ts ← merge/rawcode/LogicConfig.ts (lines 14-35)
LayerBasicTransform.ts ← merge/rawcode/LogicLoaderBasic.ts (lines 8-24)
LayerBasicRenderer.ts ← merge/rawcode/LogicRendererPixi.ts (lines 17-58)
LayerBasicMath.ts ← merge/rawcode/LogicMath.ts (lines 502-516)


JSON Configuration Preset
File: shared/layer/MainConfig.json
{
  "imageRegistry": {
    "logo": "@shared/Asset/SAMPLE.png",
    "bg": "@shared/Asset/MAINBG.png",
    "gear": "@shared/Asset/GEAR1.png"
  },
  "layers": [
    {
      "id": "bg_layer",
      "imageRef": { "kind": "urlId", "id": "bg" },
      "position": { "xPct": 50, "yPct": 50 },
      "scale": { "pct": 100 },
      "angleDeg": 0
    },
    {
      "id": "logo_layer", 
      "imageRef": { "kind": "urlId", "id": "logo" },
      "position": { "xPct": 50, "yPct": 30 },
      "scale": { "pct": 50 },
      "angleDeg": 15
    }
  ]
}

Integration with Yuzha
Modify: yuzha/src/MainScreen.tsx
// Add import
import { LayerBasicCore } from "@shared/layer";

// In useEffect after canvas initialization
const layerSystem = new LayerBasicCore();
await layerSystem.loadFromConfig("@shared/layer/MainConfig.json");
layerSystem.attachToThreeScene(threeScene);

Step-by-Step Implementation
Step 1: Create Type Definitions
Extract interfaces from sceneTypes.ts
Define LayerConfig, ImageRef, ImageRegistry types
Create processor interface contracts
Step 2: Implement Asset Management
Copy asset resolution logic from LogicConfig.ts
Handle @shared/ path resolution
Implement texture loading with Three.js
Step 3: Build Transform Processor
Extract transform calculations from LogicLoaderBasic.ts
Convert percentage positions to world coordinates
Apply scale and rotation transforms
Step 4: Create Three.js Renderer
Adapt PIXI rendering logic to Three.js
Create mesh from texture and transform data
Add to Three.js scene
Step 5: Build Core Pipeline
Copy orchestration pattern from logicLoader.ts
Chain processors: Assets → Transform → Renderer
Implement plugin registration system
Step 6: Connect to Yuzha
Integrate with existing @shared/stages1 system
Add layer system to MainScreen component
Test rendering in browser
Step 7: Create Test Suite
Write unit tests for each processor
Integration test for full pipeline
Visual regression test for rendering

Success Criteria
 JSON config loads without errors
 Images display at correct positions/scales/rotations
 All TypeScript types resolve correctly
 ESLint passes with zero warnings
 Prettier formatting applied
 Test suite passes 100%
 Visual output matches expected layout
 Integration works in yuzha MainScreen


Mandatory Contracts

#LayerBasicCore Interface
interface LayerBasicCore {
  loadFromConfig(configPath: string): Promise<void>;
  attachToThreeScene(scene: THREE.Scene): void;
  dispose(): void;
}

#Processor Interface
interface LayerProcessor<T> {
  process(data: LayerData): T;
  getName(): string;
}


Error Handling Contract
All async operations must handle errors gracefully
Missing assets should log warnings, not crash
Invalid JSON should provide helpful error messages


Test Requirements
Unit Tests (shared/layer/tests/)
// LayerBasicCore.test.ts
describe('LayerBasicCore', () => {
  it('loads valid JSON config');
  it('handles missing image files');
  it('processes transforms correctly');
});

// LayerBasicTransform.test.ts  
describe('LayerBasicTransform', () => {
  it('converts percentage to world coords');
  it('applies rotation correctly');
  it('handles scale transforms');
});



Integration Test
// integration.test.ts
describe('Full Pipeline', () => {
  it('loads JSON and renders to Three.js scene');
  it('matches visual snapshot');
});

Code Quality Checks
# Must pass all of these:
npm run typecheck     # TypeScript compilation
npm run lint         # ESLint with zero warnings  
npm run format       # Prettier formatting
npm run test         # Jest test suite

Implementation Notes for AI Agent
Start with types first - Define all interfaces before implementation
Use existing patterns - Follow exact patterns from referenced rawcode files
Keep processors pure - No side effects, stateless functions only
Error boundaries - Wrap all async operations in try/catch
Progressive testing - Test each processor individually before integration
Visual verification - Confirm images appear in correct positions
Performance - Use Three.js best practices for mesh creation/disposal
Final Validation
Before marking complete, verify:

Visual output shows images from JSON at correct positions
All tests pass
TypeScript compiles without errors
Code follows project formatting standards
Integration works seamlessly with existing yuzha application





















