import { Sprite } from "pixi.js";
import type { Application } from "pixi.js";
import type { BuiltLayer } from "./LogicTypes";
import { isWebGLAvailable } from "./LogicCapability";

type Aura = {
  sprite: Sprite;
  baseScale: number;
  strength: number;
  pulseMs?: number;
  color?: number;
  alpha: number;
};
type Distort = { ampPx: number; speed: number; baseX: number; baseY: number };
type Shock = { period: number; maxScale: number; fade: boolean; baseScale: number };

type AdvItem = {
  idx: number;
  auras: Aura[];
  distort?: Distort;
  shock?: Shock;
};

function canUseAdvanced(): boolean {
  const okGL = isWebGLAvailable();
  // @ts-ignore
  const mem = (navigator as any).deviceMemory as number | undefined;
  const cores = navigator.hardwareConcurrency || 4;
  const okHW = (mem === undefined || mem >= 4) && cores >= 4;
  return okGL && okHW;
}

export function buildEffectsAdvanced(_app: Application, built: BuiltLayer[]) {
  if (!canUseAdvanced())
    return { items: [] as AdvItem[], tick: (_t: number) => {}, cleanup: () => {} };

  const items: AdvItem[] = [];

  for (let i = 0; i < built.length; i += 1) {
    const b = built[i];
    if (!b) continue;
    const fx = b.cfg.effects;
    if (!Array.isArray(fx) || fx.length === 0) continue;
    const baseScale = (b.cfg.scale?.pct ?? 100) / 100;
    const adv: AdvItem = { idx: i, auras: [] };

    for (const e of fx) {
      if (!e || typeof e !== "object") continue;
      if ((e as any).type === "glow") {
        const color = typeof (e as any).color === "number" ? (e as any).color : 0xffff00;
        const alpha = typeof (e as any).alpha === "number" ? (e as any).alpha : 0.4;
        const scale = typeof (e as any).scale === "number" ? (e as any).scale : 0.15;
        const pulseMs = typeof (e as any).pulseMs === "number" ? (e as any).pulseMs : undefined;
        const auraSprite = new Sprite(b.sprite.texture);
        auraSprite.anchor.set(0.5);
        auraSprite.tint = color;
        auraSprite.alpha = alpha;
        auraSprite.blendMode = 1;
        const parent = b.sprite.parent;
        if (parent) {
          const index = parent.getChildIndex(b.sprite);
          parent.addChildAt(auraSprite, index);
        }
        adv.auras.push({
          sprite: auraSprite,
          baseScale: baseScale * (1 + scale),
          strength: 1,
          pulseMs,
          color,
          alpha,
        });
      } else if ((e as any).type === "bloom") {
        const strength = typeof (e as any).strength === "number" ? (e as any).strength : 0.6;
        const auraSprite = new Sprite(b.sprite.texture);
        auraSprite.anchor.set(0.5);
        auraSprite.alpha = Math.min(1, 0.3 + strength * 0.4);
        auraSprite.blendMode = 1;
        const parent = b.sprite.parent;
        if (parent) {
          const index = parent.getChildIndex(b.sprite);
          parent.addChildAt(auraSprite, index);
        }
        adv.auras.push({
          sprite: auraSprite,
          baseScale: baseScale * (1 + 0.2 + strength * 0.2),
          strength,
          alpha: auraSprite.alpha,
        });
      } else if ((e as any).type === "distort") {
        const ampPx = typeof (e as any).ampPx === "number" ? (e as any).ampPx : 2;
        const speed = typeof (e as any).speed === "number" ? (e as any).speed : 0.5;
        adv.distort = { ampPx, speed, baseX: b.sprite.x, baseY: b.sprite.y };
      } else if ((e as any).type === "shockwave") {
        const periodMs = typeof (e as any).periodMs === "number" ? (e as any).periodMs : 1200;
        const maxScale = typeof (e as any).maxScale === "number" ? (e as any).maxScale : 1.3;
        const fade = (e as any).fade !== false;
        adv.shock = { period: periodMs, maxScale, fade, baseScale };
      }
    }

    if (adv.auras.length || adv.distort || adv.shock) items.push(adv);
  }

  function tick(elapsed: number, builtRef: BuiltLayer[]) {
    for (const it of items) {
      const b = builtRef[it.idx];
      if (!b) continue;
      for (const a of it.auras) {
        a.sprite.x = b.sprite.x;
        a.sprite.y = b.sprite.y;
        a.sprite.rotation = b.sprite.rotation;
        let s = a.baseScale;
        if (a.pulseMs) {
          const T = a.pulseMs / 1000;
          if (T > 0) s = a.baseScale * (1 + 0.05 * Math.sin(((2 * Math.PI) / T) * elapsed));
        }
        a.sprite.scale.set(s, s);
      }
      if (it.distort) {
        const { ampPx, speed } = it.distort;
        const t = elapsed * speed * 2 * Math.PI;
        b.sprite.x += ampPx * Math.sin(t);
        b.sprite.y += ampPx * Math.cos(t * 0.9);
      }
      if (it.shock) {
        const T = it.shock.period / 1000;
        if (T > 0) {
          const phase = (elapsed % T) / T;
          const mul = 1 + (it.shock.maxScale - 1) * Math.sin(Math.PI * phase);
          const s = it.shock.baseScale * mul;
          b.sprite.scale.set(s, s);
          if (it.shock.fade) b.sprite.alpha = 0.8 + 0.2 * Math.cos(Math.PI * phase);
        }
      }
    }
  }

  function cleanup() {
    for (const it of items) {
      for (const a of it.auras) {
        try {
          a.sprite.destroy();
        } catch {
          // ignore destroy errors
        }
      }
    }
  }

  return { items, tick, cleanup };
}
