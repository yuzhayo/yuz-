import React from "react";
import type { ClockHand, ClockHandSelection, LogicConfig, LayerConfig } from "./sceneTypes";
import cfgJson from "../LogicConfig";
import { clamp, clamp01, clampRpm60, toRad } from "./LogicMath";
import { projectToRectBorder } from "./LayerOrbit";
import { logicZIndexFor } from "./LogicLoaderBasic";
import { computeBasicEffectState } from "./LayerEffect";

type ImgItem = {
  el: HTMLImageElement;
  cfg: LayerConfig;
  // spin
  spinRadPerSec: number;
  spinDir: 1 | -1;
  baseRad: number;
  // orbit
  orbitRadPerSec: number;
  orbitDir: 1 | -1;
  centerPct: { x: number; y: number };
  centerPx: { cx: number; cy: number };
  radius: number;
  basePhase: number;
  orientPolicy: "none" | "auto" | "override";
  orientDegRad: number;
  // clock
  clockEnabled: boolean;
  clockOverrideSpin: boolean;
  clockOverrideOrbit: boolean;
  clockHandSpin: "second" | "minute" | "hour";
  clockHandOrbit: "second" | "minute" | "hour";
  clockFormat: 12 | 24;
  clockSmooth: boolean;
  clockTipRad: number;
  clockSource: { mode: "device" | "utc" | "server"; tzOffsetMinutes?: number | null };
  // basic effects (reuse LayerEffect helper)
  basicEffects: Array<{
    type: "fade";
    from: number;
    to: number;
    durationMs: number;
    loop: boolean;
    easing: "linear" | "sineInOut";
  } | {
    type: "pulse";
    property: "scale" | "alpha";
    amp: number;
    periodMs: number;
    phaseDeg: number;
  } | {
    type: "tilt";
    mode: "pointer" | "device" | "time";
    axis: "both" | "x" | "y";
    maxDeg: number;
    periodMs?: number;
  }>;
  // tilt state for helper function
  tiltState: { prevTiltRad?: number };
};

function urlForImageRef(cfg: LogicConfig, ref: LayerConfig["imageRef"]): string | null {
  if (ref.kind === "url") return ref.url;
  return cfg.imageRegistry[ref.id] ?? null;
}


export default function LogicStageDom() {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const imgsRef = React.useRef<ImgItem[]>([]);
  const cfg = cfgJson as unknown as LogicConfig;

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.style.position = "relative";

    // pointer state for tilt
    let px = 0.5;
    let py = 0.5;
    const onMouse = (ev: MouseEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      px = Math.max(0, Math.min(1, ev.clientX / w));
      py = Math.max(0, Math.min(1, ev.clientY / h));
    };
    const onTouch = (ev: TouchEvent) => {
      const t = ev.touches && ev.touches[0];
      if (!t) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      px = Math.max(0, Math.min(1, t.clientX / w));
      py = Math.max(0, Math.min(1, t.clientY / h));
    };
    try {
      window.addEventListener("mousemove", onMouse, { passive: true });
      window.addEventListener("touchmove", onTouch, { passive: true });
    } catch {}

    // Build images
    const items: ImgItem[] = [];
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const layer of cfg.layers) {
      const url = urlForImageRef(cfg, layer.imageRef);
      if (!url) continue;
      const img = new Image();
      img.decoding = "async";
      img.loading = "lazy";
      img.draggable = false;
      img.style.position = "absolute";
      img.style.left = "0px";
      img.style.top = "0px";
      img.style.willChange = "transform";
      img.style.pointerEvents = "none";
      img.style.zIndex = String(logicZIndexFor(layer));

      root.appendChild(img);

      const clockCfg = layer.clock;
      const clockEnabled = !!clockCfg?.enabled;
      const spinHandSel: ClockHandSelection =
        clockCfg?.spinHand ?? (clockEnabled ? "second" : "none");
      const orbitHandSel: ClockHandSelection = clockCfg?.orbitHand ?? "none";
      const clockOverrideSpin = clockEnabled && spinHandSel !== "none";
      const clockOverrideOrbit = clockEnabled && orbitHandSel !== "none";
      const clockHandSpin: ClockHand = spinHandSel === "none" ? "second" : spinHandSel;
      const clockHandOrbit: ClockHand = orbitHandSel === "none" ? "second" : orbitHandSel;
      const clockFormat = (clockCfg?.format === 24 ? 24 : 12) as 12 | 24;
      const clockSmooth = clockCfg?.smooth ?? true;
      const clockTipRad = toRad(clockCfg?.tip?.angleDeg ?? 90);
      const clockSourceMode = clockCfg?.timezone ?? "device";
      const clockSource = {
        mode: (clockSourceMode === "utc"
          ? "utc"
          : clockSourceMode === "server"
            ? "server"
            : "device") as "device" | "utc" | "server",
        tzOffsetMinutes: clockCfg?.source?.tzOffsetMinutes ?? null,
      };
      // spin
      const sRpm = clampRpm60(layer.spinRPM);
      const spinDir: 1 | -1 = layer.spinDir === "ccw" ? -1 : 1;
      const spinRadPerSec = (sRpm * Math.PI) / 30;
      const baseRad = toRad(layer.angleDeg ?? 0);

      // orbit
      const oRpm = clampRpm60(layer.orbitRPM);
      const orbitDir: 1 | -1 = layer.orbitDir === "ccw" ? -1 : 1;
      const orbitRadPerSec = (oRpm * Math.PI) / 30;
      const orbitCenterSeed = clockOverrideOrbit
        ? (clockCfg?.orbitCenter ?? clockCfg?.center ?? layer.orbitCenter ?? { xPct: 50, yPct: 50 })
        : (layer.orbitCenter ?? { xPct: 50, yPct: 50 });
      const centerPct = {
        x: clamp(orbitCenterSeed.xPct ?? 50, 0, 100),
        y: clamp(orbitCenterSeed.yPct ?? 50, 0, 100),
      };
      const cx = w * (centerPct.x / 100);
      const cy = h * (centerPct.y / 100);
      const bx = w * ((layer.position.xPct ?? 0) / 100);
      const by = h * ((layer.position.yPct ?? 0) / 100);
      const start = projectToRectBorder(cx, cy, bx, by, w, h);
      const radius = Math.hypot(start.x - cx, start.y - cy);
      const orientPolicy = (layer.orbitOrientPolicy ?? "none") as "none" | "auto" | "override";
      const orientDeg =
        typeof layer.orbitOrientDeg === "number" && isFinite(layer.orbitOrientDeg)
          ? layer.orbitOrientDeg
          : 0;
      const orientDegRad = toRad(orientDeg);
      const phaseDeg = layer.orbitPhaseDeg;
      const basePhase =
        typeof phaseDeg === "number" && isFinite(phaseDeg)
          ? toRad(((phaseDeg % 360) + 360) % 360)
          : Math.atan2(start.y - cy, start.x - cx);

      // Parse basic effects for helper function
      const basicEffects: ImgItem["basicEffects"] = [];
      if (Array.isArray(layer.effects)) {
        for (const e of layer.effects) {
          if (!e || typeof e !== "object") continue;
          const type = (e as any).type;
          if (type === "fade") {
            basicEffects.push({
              type: "fade",
              from: typeof (e as any).from === "number" ? (e as any).from : 1,
              to: typeof (e as any).to === "number" ? (e as any).to : 1,
              durationMs:
                typeof (e as any).durationMs === "number" && (e as any).durationMs > 0
                  ? (e as any).durationMs
                  : 1000,
              loop: (e as any).loop !== false,
              easing: (e as any).easing === "sineInOut" ? "sineInOut" : "linear",
            });
          } else if (type === "pulse") {
            basicEffects.push({
              type: "pulse",
              property: (e as any).property === "alpha" ? "alpha" : "scale",
              amp:
                typeof (e as any).amp === "number"
                  ? (e as any).amp
                  : (e as any).property === "alpha"
                    ? 0.1
                    : 0.05,
              periodMs:
                typeof (e as any).periodMs === "number" && (e as any).periodMs > 0
                  ? (e as any).periodMs
                  : 1000,
              phaseDeg: typeof (e as any).phaseDeg === "number" ? (e as any).phaseDeg : 0,
            });
          } else if (type === "tilt") {
            basicEffects.push({
              type: "tilt",
              mode:
                (e as any).mode === "time" || (e as any).mode === "device"
                  ? (e as any).mode
                  : "pointer",
              axis: (e as any).axis === "x" || (e as any).axis === "y" ? (e as any).axis : "both",
              maxDeg: typeof (e as any).maxDeg === "number" ? (e as any).maxDeg : 8,
              periodMs:
                typeof (e as any).periodMs === "number" && (e as any).periodMs > 0
                  ? (e as any).periodMs
                  : 4000,
            });
          }
        }
      }

      items.push({
        el: img,
        cfg: layer,
        spinRadPerSec,
        spinDir,
        baseRad,
        orbitRadPerSec,
        orbitDir,
        centerPct,
        centerPx: { cx, cy },
        radius,
        basePhase,
        orientPolicy,
        orientDegRad,
        clockEnabled: clockEnabled,
        clockOverrideSpin,
        clockOverrideOrbit,
        clockHandSpin,
        clockHandOrbit,
        clockFormat,
        clockSmooth,
        clockTipRad,
        clockSource,
        basicEffects,
        tiltState: {},
      });
    }

    imgsRef.current = items;

    let elapsed = 0;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = 1 / 60; // simple steady clock
      elapsed += dt;
      const ww = window.innerWidth;
      const hh = window.innerHeight;

      for (const it of imgsRef.current) {
        // Orbit position
        let x = ww * ((it.cfg.position.xPct ?? 0) / 100);
        let y = hh * ((it.cfg.position.yPct ?? 0) / 100);
        let angle = it.baseRad;
        let s = (it.cfg.scale?.pct ?? 100) / 100;
        let alphaMul = 1;

        if (it.clockEnabled && it.clockOverrideOrbit && it.radius > 0) {
          // time-driven orbit angle
          const now = Date.now();
          const useUTC = it.clockSource.mode === "utc" || it.clockSource.tzOffsetMinutes != null;
          const shift = (it.clockSource.tzOffsetMinutes ?? 0) * 60000;
          const d = new Date(useUTC ? now + shift : now);
          const H = useUTC ? d.getUTCHours() : d.getHours();
          const M = useUTC ? d.getUTCMinutes() : d.getMinutes();
          const S = useUTC ? d.getUTCSeconds() : d.getSeconds();
          const ms = useUTC ? d.getUTCMilliseconds() : d.getMilliseconds();
          let tRad = 0;
          if (it.clockHandOrbit === "second") {
            const sVal = it.clockSmooth ? S + ms / 1000 : S;
            tRad = 2 * Math.PI * (sVal / 60);
          } else if (it.clockHandOrbit === "minute") {
            const mVal = it.clockSmooth ? M + S / 60 : M;
            tRad = 2 * Math.PI * (mVal / 60);
          } else {
            const hVal =
              it.clockFormat === 24
                ? (H + (it.clockSmooth ? M / 60 + S / 3600 : 0)) / 24
                : ((H % 12) + (it.clockSmooth ? M / 60 + S / 3600 : 0)) / 12;
            tRad = 2 * Math.PI * hVal;
          }
          const cx = ww * clamp01(it.centerPct.x / 100);
          const cy = hh * clamp01(it.centerPct.y / 100);
          x = cx + it.radius * Math.cos(tRad);
          y = cy + it.radius * Math.sin(tRad);
          if (
            it.orientPolicy === "override" ||
            (it.orientPolicy === "auto" && it.spinRadPerSec <= 0)
          ) {
            angle = tRad + it.orientDegRad;
          }
        } else if (it.orbitRadPerSec > 0 && it.radius > 0) {
          const cx = ww * clamp01(it.centerPct.x / 100);
          const cy = hh * clamp01(it.centerPct.y / 100);
          const tAngle = it.basePhase + it.orbitDir * it.orbitRadPerSec * elapsed;
          x = cx + it.radius * Math.cos(tAngle);
          y = cy + it.radius * Math.sin(tAngle);
          if (
            it.orientPolicy === "override" ||
            (it.orientPolicy === "auto" && it.spinRadPerSec <= 0)
          ) {
            angle = tAngle + it.orientDegRad;
          }
        }

        // Clock rotation override (phase 1)
        if (it.clockEnabled && it.clockOverrideSpin) {
          // Compute time-based angle
          const now = Date.now();
          const useUTC = it.clockSource.mode === "utc" || it.clockSource.tzOffsetMinutes != null;
          const shift = (it.clockSource.tzOffsetMinutes ?? 0) * 60000;
          const d = new Date(useUTC ? now + shift : now);
          const H = useUTC ? d.getUTCHours() : d.getHours();
          const M = useUTC ? d.getUTCMinutes() : d.getMinutes();
          const S = useUTC ? d.getUTCSeconds() : d.getSeconds();
          const ms = useUTC ? d.getUTCMilliseconds() : d.getMilliseconds();
          let tRad = 0;
          if (it.clockHandSpin === "second") {
            const sVal = it.clockSmooth ? S + ms / 1000 : S;
            tRad = 2 * Math.PI * (sVal / 60);
          } else if (it.clockHandSpin === "minute") {
            const mVal = it.clockSmooth ? M + S / 60 : M;
            tRad = 2 * Math.PI * (mVal / 60);
          } else {
            const hVal =
              it.clockFormat === 24
                ? (H + (it.clockSmooth ? M / 60 + S / 3600 : 0)) / 24
                : ((H % 12) + (it.clockSmooth ? M / 60 + S / 3600 : 0)) / 12;
            tRad = 2 * Math.PI * hVal;
          }
          angle = it.baseRad + it.clockTipRad + tRad;
        } else {
          // Spin (only if orientation didn't already override)
          if (
            !(
              it.orientPolicy === "override" ||
              (it.orientPolicy === "auto" && it.spinRadPerSec <= 0)
            )
          ) {
            if (it.spinRadPerSec > 0) {
              angle = it.baseRad + it.spinDir * it.spinRadPerSec * elapsed;
            }
          }
        }

        // Apply basic effects using helper function
        if (it.basicEffects.length > 0) {
          const effectState = computeBasicEffectState(
            it.basicEffects,
            it.tiltState,
            elapsed,
            { px, py }
          );
          
          // Apply tilt rotation delta
          const prev = it.tiltState.prevTiltRad || 0;
          if (effectState.tiltRad !== prev) {
            angle += effectState.tiltRad - prev;
            it.tiltState.prevTiltRad = effectState.tiltRad;
          }
          
          // Apply effect scale and alpha
          s *= effectState.scaleMul;
          alphaMul = Math.max(0, Math.min(1, effectState.alpha));
        }
        it.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${(angle * 180) / Math.PI}deg) scale(${s})`;
        it.el.style.opacity = String(alphaMul);
      }
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      // Recompute orbit geometry
      const ww = window.innerWidth;
      const hh = window.innerHeight;
      for (const it of imgsRef.current) {
        const cx = ww * clamp01(it.centerPct.x / 100);
        const cy = hh * clamp01(it.centerPct.y / 100);
        const bx = ww * ((it.cfg.position.xPct ?? 0) / 100);
        const by = hh * ((it.cfg.position.yPct ?? 0) / 100);
        const start = projectToRectBorder(cx, cy, bx, by, ww, hh);
        const r = Math.hypot(start.x - cx, start.y - cy);
        it.centerPx = { cx, cy };
        it.radius = r;
        // Continuity approximation: leave basePhase unchanged; next tick will update position smoothly
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      try {
        window.removeEventListener("mousemove", onMouse as any);
      } catch {}
      try {
        window.removeEventListener("touchmove", onTouch as any);
      } catch {}
      for (const it of imgsRef.current) {
        try {
          root.removeChild(it.el);
        } catch {}
      }
      imgsRef.current = [];
    };
  }, [cfg]);

  return <div ref={rootRef} className="w-screen h-screen" />;
}
