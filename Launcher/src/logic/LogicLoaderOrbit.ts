import type { Application, Sprite } from "pixi.js";
import type { BuiltLayer } from "./LogicTypes";
import type { LayerConfig } from "./sceneTypes";
import { clamp, clamp01, toRad, normDeg, clampRpm60 } from "./LogicMath";
import { STAGE_WIDTH, STAGE_HEIGHT } from "@shared/stages/Stage2048";

export type OrbitItem = {
  sprite: Sprite;
  cfg: LayerConfig;
  dir: 1 | -1;
  radPerSec: number;
  centerPct: { x: number; y: number };
  centerPx: { cx: number; cy: number };
  radius: number;
  basePhase: number;
  orientPolicy: "none" | "auto" | "override";
  orientDegRad: number;
  spinRpm: number;
};

function projectToRectBorder(
  cx: number,
  cy: number,
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number } {
  if (x >= 0 && x <= w && y >= 0 && y <= h) return { x, y };
  const dx = x - cx;
  const dy = y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const eps = 1e-6;
  const cand: { t: number; x: number; y: number }[] = [];
  if (Math.abs(dx) > eps) {
    const t1 = (0 - cx) / dx;
    const y1 = cy + t1 * dy;
    if (t1 > 0 && y1 >= -1 && y1 <= h + 1) cand.push({ t: t1, x: 0, y: y1 });
    const t2 = (w - cx) / dx;
    const y2 = cy + t2 * dy;
    if (t2 > 0 && y2 >= -1 && y2 <= h + 1) cand.push({ t: t2, x: w, y: y2 });
  }
  if (Math.abs(dy) > eps) {
    const t3 = (0 - cy) / dy;
    const x3 = cx + t3 * dx;
    if (t3 > 0 && x3 >= -1 && x3 <= w + 1) cand.push({ t: t3, x: x3, y: 0 });
    const t4 = (h - cy) / dy;
    const x4 = cx + t4 * dx;
    if (t4 > 0 && x4 >= -1 && x4 <= w + 1) cand.push({ t: t4, x: x4, y: h });
  }
  if (cand.length === 0) return { x: clamp(x, 0, w), y: clamp(y, 0, h) };
  cand.sort((a, b) => a.t - b.t);
  const first = cand[0];
  if (!first) {
    return { x: clamp(x, 0, w), y: clamp(y, 0, h) };
  }
  return { x: first.x, y: first.y };
}

export function buildOrbit(
  _app: Application,
  built: BuiltLayer[],
  spinRpmBySprite: Map<Sprite, number>,
) {
  const items: OrbitItem[] = [];

  for (const b of built) {
    if (!b.cfg.clock?.enabled) {
      const rpm = clampRpm60(b.cfg.orbitRPM);
      if (rpm <= 0) continue;

      const c = b.cfg.orbitCenter || { xPct: 50, yPct: 50 };
      const centerPct = {
        x: clamp(c.xPct ?? 50, 0, 100),
        y: clamp(c.yPct ?? 50, 0, 100),
      };
      const dir = b.cfg.orbitDir === "ccw" ? -1 : (1 as 1 | -1);
      const w = STAGE_WIDTH;
      const h = STAGE_HEIGHT;
      const cx = w * (centerPct.x / 100);
      const cy = h * (centerPct.y / 100);
      const bx = w * ((b.cfg.position?.xPct ?? 0) / 100);
      const by = h * ((b.cfg.position?.yPct ?? 0) / 100);
      const start = projectToRectBorder(cx, cy, bx, by, w, h);
      const r = Math.hypot(start.x - cx, start.y - cy);
      if (r <= 0) continue;

      const phaseDeg = b.cfg.orbitPhaseDeg;
      const phase =
        typeof phaseDeg === "number" && isFinite(phaseDeg)
          ? toRad(normDeg(phaseDeg))
          : Math.atan2(start.y - cy, start.x - cx);
      const radPerSec = (rpm * Math.PI) / 30;
      const policy = (b.cfg.orbitOrientPolicy ?? "none") as "none" | "auto" | "override";
      const orientDeg =
        typeof b.cfg.orbitOrientDeg === "number" && isFinite(b.cfg.orbitOrientDeg)
          ? b.cfg.orbitOrientDeg
          : 0;
      const orientRad = toRad(normDeg(orientDeg));
      const spinRpm = spinRpmBySprite.get(b.sprite) ?? 0;
      items.push({
        sprite: b.sprite,
        cfg: b.cfg,
        dir,
        radPerSec,
        centerPct,
        centerPx: { cx, cy },
        radius: r,
        basePhase: phase,
        orientPolicy: policy,
        orientDegRad: orientRad,
        spinRpm,
      });
    }
  }

  function recompute(elapsed: number) {
    const w = STAGE_WIDTH;
    const h = STAGE_HEIGHT;
    for (const it of items) {
      const oldAngle = Math.atan2(it.sprite.y - it.centerPx.cy, it.sprite.x - it.centerPx.cx);
      const cx = w * clamp01(it.centerPct.x / 100);
      const cy = h * clamp01(it.centerPct.y / 100);
      const bx = w * ((it.cfg.position?.xPct ?? 0) / 100);
      const by = h * ((it.cfg.position?.yPct ?? 0) / 100);
      const start = projectToRectBorder(cx, cy, bx, by, w, h);
      const r = Math.hypot(start.x - cx, start.y - cy);
      it.centerPx = { cx, cy };
      it.radius = r;
      if (r > 0) {
        const currentBase = oldAngle;
        it.basePhase = currentBase - it.dir * it.radPerSec * elapsed;
        it.sprite.x = cx + r * Math.cos(currentBase);
        it.sprite.y = cy + r * Math.sin(currentBase);
      }
    }
  }

  function tick(elapsed: number) {
    for (const it of items) {
      if (it.radius <= 0) continue;
      const angle = it.basePhase + it.dir * it.radPerSec * elapsed;
      it.sprite.x = it.centerPx.cx + it.radius * Math.cos(angle);
      it.sprite.y = it.centerPx.cy + it.radius * Math.sin(angle);
      if (it.orientPolicy === "override" || (it.orientPolicy === "auto" && it.spinRpm <= 0)) {
        it.sprite.rotation = angle + it.orientDegRad;
      }
    }
  }

  return { items, recompute, tick };
}
