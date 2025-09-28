import { Assets, Container, Sprite } from "pixi.js";
import type { Application } from "pixi.js";
import type { LogicConfig, LayerConfig } from "./sceneTypes";
import { logicApplyBasicTransform, logicZIndexFor } from "./LogicLoaderBasic";
import { createLayerSpinManager } from "./LayerSpin";
import { createLayerClockManager } from "./LayerClock";
import { buildOrbit } from "./LogicLoaderOrbit";
import { buildEffects } from "./LogicLoaderEffects";
import { buildEffectsAdvanced } from "./LogicLoaderEffectsAdvanced";

export type BuiltLayer = {
  id: string;
  sprite: Sprite;
  cfg: LayerConfig;
};

export type BuildResult = {
  container: Container;
  layers: BuiltLayer[];
};

function getUrlForImageRef(cfg: LogicConfig, ref: LayerConfig["imageRef"]): string | null {
  if (ref.kind === "url") return ref.url;
  const url = cfg.imageRegistry[ref.id];
  return url ?? null;
}

// z-index and base transforms are delegated to Basic processor helpers

export async function buildSceneFromLogic(
  app: Application,
  cfg: LogicConfig,
): Promise<BuildResult> {
  const container = new Container();
  container.sortableChildren = true;

  // Sort layers by z-index then id fallback, to define render order
  const layers = [...cfg.layers].sort((a, b) => {
    const za = logicZIndexFor(a);
    const zb = logicZIndexFor(b);
    if (za !== zb) return za - zb;
    return a.id.localeCompare(b.id);
  });

  const built: BuiltLayer[] = [];
  let warnedZ = false;

  // Prefetch assets in parallel to avoid sequential fetch latency
  const urlSet = new Set<string>();
  for (const layer of layers) {
    const u = getUrlForImageRef(cfg, layer.imageRef);
    if (u) urlSet.add(u);
  }
  try {
    await Promise.all(
      Array.from(urlSet).map((u) =>
        Assets.load(u).catch((e) => {
          console.warn("[logic] Preload failed for", u, e);
        }),
      ),
    );
  } catch {}

  for (const layer of layers) {
    // Warn once if legacy `z` is present and differs from ID-derived order
    const anyLayer = layer as unknown as { z?: number };
    if (!warnedZ && typeof anyLayer.z === "number") {
      const derived = logicZIndexFor(layer);
      if (anyLayer.z !== derived) {
        console.warn(
          "[logic] `z` is deprecated and ignored. Use numeric ID order. Layer:",
          layer.id,
          " legacy z:",
          anyLayer.z,
          " derived:",
          derived,
        );
      } else {
        console.warn(
          "[logic] `z` property is deprecated and ignored. Remove it from config. Layer:",
          layer.id,
        );
      }
      warnedZ = true;
    }

    const url = getUrlForImageRef(cfg, layer.imageRef);
    if (!url) {
      console.warn("[logic] Missing image URL for layer", layer.id, layer.imageRef);
      continue;
    }
    try {
      // Texture should be cached from prefetch; load again if needed
      const texture = await Assets.load(url);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      logicApplyBasicTransform(app, sprite, layer);
      // Set zIndex from ID-derived order only
      sprite.zIndex = logicZIndexFor(layer);
      container.addChild(sprite);
      built.push({ id: layer.id, sprite, cfg: layer });
    } catch (e) {
      console.error("[logic] Failed to load", url, "for layer", layer.id, e);
    }
  }

  // Basic spin runtime (handles only basic RPM-based spins)
  const spinManager = createLayerSpinManager();
  spinManager.init(app, built);

  // Clock runtime (handles clock-driven spins and orbital motion)  
  const clockManager = createLayerClockManager();
  clockManager.init(app, built);

  // Build RPM map for orbit system compatibility
  const spinRpmBySprite = new Map<Sprite, number>();
  for (const b of built) {
    spinRpmBySprite.set(b.sprite, spinManager.getSpinRpm(b.sprite));
  }

  // Orbit runtime: build items and helpers
  const orbit = buildOrbit(app, built, spinRpmBySprite);
  // Effects (Phase 1: property effects only)
  const effects = buildEffects(app, built);
  const adv = buildEffectsAdvanced(app, built);

  let elapsed = 0;
  const onResize = () => {
    for (const b of built) logicApplyBasicTransform(app, b.sprite, b.cfg);
    spinManager.recompute();
    clockManager.recompute();
    orbit.recompute(elapsed);
  };
  const resizeListener = () => onResize();
  window.addEventListener("resize", resizeListener);

  const tick = () => {
    const spinItems = spinManager.getItems();
    const clockItems = clockManager.getItems();
    if (
      spinItems.length === 0 &&
      orbit.items.length === 0 &&
      clockItems.length === 0 &&
      effects.items.length === 0 &&
      adv.items.length === 0
    )
      return;
    const dt = (app.ticker.deltaMS || 16.667) / 1000;
    elapsed += dt;
    // Basic Spin (handles only basic RPM-based spins)
    spinManager.tick(elapsed);
    // Orbit
    orbit.tick(elapsed);
    // Clock (handles clock-driven spins and orbital motion)
    clockManager.tick();
    // Effects
    effects.tick(elapsed, built);
    // Advanced Effects (gated)
    adv.tick(elapsed, built);
  };

  // Always add ticker if we have any animations
  const hasAnimations = () => {
    try {
      const spinItems = spinManager.getItems();
      const clockItems = clockManager.getItems();
      return (
        spinItems.length > 0 ||
        orbit.items.length > 0 ||
        clockItems.length > 0 ||
        effects.items.length > 0 ||
        adv.items.length > 0
      );
    } catch (e) {
      console.warn("[logicLoader] Error checking animations:", e);
      return false;
    }
  };

  try {
    if (hasAnimations()) {
      app.ticker.add(tick);
    }
  } catch (e) {
    console.error("[logicLoader] Error adding ticker:", e);
  }

  const prevCleanup = (container as any)._cleanup as (() => void) | undefined;
  (container as any)._cleanup = () => {
    try {
      window.removeEventListener("resize", resizeListener);
    } catch {}
    try {
      app.ticker.remove(tick);
    } catch {}
    try {
      spinManager.dispose();
    } catch {}
    try {
      clockManager.dispose();
    } catch {}
    try {
      (effects as any).cleanup?.();
    } catch {}
    try {
      adv.cleanup();
    } catch {}
    try {
      prevCleanup?.();
    } catch {}
  };

  return { container, layers: built };
}
