# Logic Pipeline Migration Plan

This document outlines how we replicate the current launcher workflow while introducing a new pipeline, leaving the existing files untouched as the legacy reference.

## Target Folder Layout

```
shared/stages/newPipeline/
  LayerConfig.ts
  LayerCore.ts
  LayerEngine.ts
  LayerStages.tsx
  MainScreen2.tsx
```

(Additional splits can happen later if a file grows too large.)

## LayerConfig.ts (Loader / Schema)

- Copy JSON loader and asset remapping logic from `Launcher/src/LogicConfig.ts`.
- Decide where the source JSON lives: either keep using `Launcher/src/LogicConfig.json` or copy it to `shared/stages/newPipeline/LayerConfig.json` so the new loader can resolve assets independently.
- Define and export the schema types from `LayerCreator.ts` that describe the config:
  - `ImageRegistry`, `ImageRef`, `LayerConfig`, `LogicConfig`, and (optionally) `LayerModule`.
- Import schema fragments referenced inside `LayerConfig` so the config remains typesafe:
  - clock types from `LayerClock.ts` (`ClockConfig`, `ClockCenterConfig`, etc.).
  - effect types from `LayerEffect.ts` (`LayerEffectConfig`).
  - orbit configuration fragments from `LayerOrbit.ts` (or inline equivalent shapes).
- Export a typed loader (e.g., `getLogicConfig()` or a default export) consumed by later stages.

## LayerCore.ts (Shared Math + Manager Contracts)

- Move stage math helpers from `LayerCreator.ts`:
  - `STAGE_WIDTH`, `STAGE_HEIGHT`, `STAGE_CSS`, `calculateStageTransform`, `transformCoordinatesToStage`, `isWithinStage`, `ensureStageStyles`, and the `StageTransform`/`StageCoordinates` interfaces.
- Include the `StageTransformManager` class (Block 6) so coordinate / resize logic is centralized here.
- Re-export or inline the math helpers from `logic/math.ts` (clamp, toRad, etc.) for self-contained usage.
- Collect animation manager interfaces and runtime types:
  - spin: `LayerSpinManager`, `BasicSpinItem`, `SpinItem` from `LayerSpin.ts`.
  - clock: `LayerClockManager`, `ClockItem`, `ClockGeometry`, `SpinSettings`, `OrbitSettings`, etc. from `LayerClock.ts`.
  - orbit: `LayerOrbitManager`, `OrbitItem` from `LayerOrbit.ts`.
  - effects: `LayerEffectManager`, `LayerEffectItem`, `EffectHandler`, and normalized specs (`FadeSpec`, `PulseSpec`, `GlowSpec`, `BloomSpec`, `DistortSpec`, `ShockwaveSpec`) from `LayerEffect.ts`.

## LayerEngine.ts (Scene Builder)

- Bring over all stage/pixi factory logic from `LayerCreator.ts` block 13:
  - `createStage2048`, `createPixiApplication`, `Stage2048Options`, `Stage2048Instance`.
- Include the layer creator manager and its helpers:
  - `createLayerCreatorManager`, `createPixiFactories`, `createAnimationManagers` plus types (`LayerCreatorManager`, `LayerCreatorItem`, `LayerCreatorManagersState`).
- Move the Pixi factories and guards:
  - `createPixiSpriteFactory`, `createPixiEffectHandler`, `isPixiApplication`.
- Re-export the scene-building APIs:
  - `buildSceneFromLogic`, `createPixiEngine`, and engine-related types (`BuildResult`, `BuiltLayer`, `PixiEngine`, `EngineHandle`, etc.).
- These implementations will import config types from `LayerConfig.ts` and manager contracts from `LayerCore.ts`.

## LayerStages.tsx (React Host)

- Copy `Stage2048System` from `Launcher/src/Stage2048System.tsx`.
- Update imports to use the new pipeline (`LayerEngine.ts`, `LayerCore.ts`).
- Keep the current resize/gesture logic so behaviour matches the legacy component.
- Export `Stage2048System` and any React-specific helpers (`Stage2048SystemProps`, `useStageCoordinates`, etc.).

## MainScreen2.tsx (UI Overlay)

- Duplicate `Launcher/src/MainScreen.tsx` into the new folder.
- Swap imports to point at `LayerStages.tsx` (and any shared UI utilities).
- Optionally add a banner or debug note so you can quickly distinguish the new screen during testing.

## Wiring & Verification Steps

1. Leave existing `Launcher/src` files untouched; they continue to act as the legacy reference.
2. Implement the new pipeline files above and ensure they compile.
3. Temporarily render `MainScreen2` (e.g., via a dev route or swap in `App.tsx`) to compare visuals with the legacy screen.
4. Once the new pipeline is verified, optionally update `App.tsx` to render `MainScreen2`, keeping the old files for historical reference until you are ready to prune them.

## Notes

- Keep `logic/math.ts` for shared math helpers; the new modules can re-export or import them as needed.
- No legacy code is removed during this migration, making it easy to diff or rollback.
- After confidence is gained, you can consider pruning or consolidating legacy modules.

