import React from "react";

export type RendererMode = "auto" | "webgl" | "three";

export type RendererAvailability = {
  webgl?: boolean;
  three?: boolean;
};

type DetectedBase = {
  via: "explicit" | "override" | "auto" | "fallback";
  fallbackFrom?: RendererMode;
};

export type DetectedRenderer =
  | (DetectedBase & { kind: "webgl" | "three" })
  | (DetectedBase & { kind: "static"; reason: string });

function getOverride(): "webgl" | "three" | null {
  if (typeof window === "undefined") return null;
  try {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("renderer");
    if (q === "webgl" || q === "three") return q;
  } catch {}
  try {
    const ls = window.localStorage.getItem("renderer");
    if (ls === "webgl" || ls === "three") return ls;
  } catch {}
  return null;
}

function makeStatic(reason: string, fallbackFrom?: RendererMode): DetectedRenderer {
  return { kind: "static", via: "fallback", fallbackFrom, reason };
}

export function detectRenderer(
  mode: RendererMode = "auto",
  availability: RendererAvailability = {},
): DetectedRenderer {
  const hasWebGL = availability.webgl ?? false;
  const hasThree = availability.three ?? false;

  const resolveExplicit = (
    target: "webgl" | "three",
    via: DetectedRenderer["via"],
  ): DetectedRenderer => {
    if (target === "webgl" && hasWebGL) return { kind: "webgl", via };
    if (target === "three" && hasThree) return { kind: "three", via };
    if (target === "webgl" && hasThree) return { kind: "three", via: "fallback", fallbackFrom: "webgl" };
    if (target === "three" && hasWebGL) return { kind: "webgl", via: "fallback", fallbackFrom: "three" };
    return makeStatic(`${target.toUpperCase()} renderer not available`, target);
  };

  if (mode === "webgl") return resolveExplicit("webgl", "explicit");
  if (mode === "three") return resolveExplicit("three", "explicit");

  const override = getOverride();
  if (override === "webgl") {
    const res = resolveExplicit("webgl", "override");
    if (res.kind === "webgl") return res;
    if (res.kind === "three" && res.via === "fallback") return res;
  } else if (override === "three") {
    const res = resolveExplicit("three", "override");
    if (res.kind === "three") return res;
    if (res.kind === "webgl" && res.via === "fallback") return res;
  }

  // Auto-detect: prefer Three.js if available, fallback to WebGL
  if (hasThree) return { kind: "three", via: "auto" };
  if (hasWebGL) return { kind: "webgl", via: "auto" };

  return makeStatic("No renderer available");
}

type RendererLabelParts = {
  label: string;
  hint?: string;
};

function formatRendererLabel(detected: DetectedRenderer): RendererLabelParts {
  const formatFallback = (kind: RendererMode | undefined) =>
    kind ? `fallback from ${kind.toUpperCase()}` : undefined;

  if (detected.kind === "webgl") {
    const suffix = detected.via === "fallback" ? formatFallback(detected.fallbackFrom) : undefined;
    return { label: "Renderer: WebGL", hint: suffix };
  }

  if (detected.kind === "three") {
    const suffix = detected.via === "fallback" ? formatFallback(detected.fallbackFrom) : undefined;
    return { label: "Renderer: Three.js", hint: suffix };
  }

  if (detected.kind === "static") {
    const hint = detected.fallbackFrom ? formatFallback(detected.fallbackFrom) : detected.reason;
    return { label: "Renderer: none", hint };
  }

  return { label: "Renderer: unknown" };
}

export type MainScreenRendererDetectorProps = {
  visible: boolean;
  rendererMode?: RendererMode;
  availability: RendererAvailability;
};

export default function MainScreenRendererDetector({ visible, rendererMode = "auto", availability }: MainScreenRendererDetectorProps) {
  const detected = React.useMemo(() => detectRenderer(rendererMode, availability), [rendererMode, availability]);
  
  const labelParts = React.useMemo(() => formatRendererLabel(detected), [detected]);
  const badgeLabel = labelParts.hint
    ? `${labelParts.label} (${labelParts.hint})`
    : labelParts.label;

  if (!visible) return null;
  
  return (
    <div className="main-screen-badge-status" aria-live="polite">
      {badgeLabel}
    </div>
  );
}

export { type RendererLabelParts, formatRendererLabel };