import React, { type CSSProperties } from "react";
import { useMainScreenGesture } from "./MainScreenGesture";

export type ModuleLink = { id: string; label: string; url: string };

function getDefaultModuleLinks(): ModuleLink[] {
  const env = import.meta.env as Record<string, string | undefined>;
  return [
    { id: "0setting", label: "0Setting", url: env.VITE_URL_0SETTING ?? "http://localhost:5001" },
    { id: "1meng", label: "1Meng", url: env.VITE_URL_1MENG ?? "http://localhost:5002" },
    { id: "3database", label: "3Database", url: env.VITE_URL_3DATABASE ?? "http://localhost:5003" },
    { id: "4extra", label: "4Extra", url: env.VITE_URL_4EXTRA ?? "http://localhost:5004" },
    { id: "5rara", label: "5Rara", url: env.VITE_URL_5RARA ?? "http://localhost:5005" },
  ];
}

export type MainScreenBtnEffectKind = "none" | "fade" | "pulse" | "glow";

export type MainScreenBtnEffectConfig = {
  kind?: MainScreenBtnEffectKind;
  intensity?: number;
};

export type MainScreenBtnEffectState = {
  open: boolean;
  hovering?: boolean;
  pressing?: boolean;
};

export type MainScreenBtnVisual = {
  panelClass: string;
  panelStyle?: CSSProperties;
  buttonClass: string;
  buttonStyle?: CSSProperties;
  badgeClass: string;
};

function useMainScreenBtnEffect(
  state: MainScreenBtnEffectState,
  cfg?: MainScreenBtnEffectConfig,
): MainScreenBtnVisual {
  const kind = cfg?.kind ?? "none";

  const basePanel: string[] = ["main-screen-panel"];
  const panelStyle: CSSProperties = {};

  if (kind === "fade") {
    basePanel.push(state.open ? "main-screen-panel--fade-open" : "main-screen-panel--fade-closed");
  }

  if (kind === "glow") {
    basePanel.push("main-screen-panel--glow");
    if (state.open) panelStyle.boxShadow = "0 24px 48px rgba(236,72,153,0.28)";
  }

  if (kind === "pulse" && state.open) {
    panelStyle.animation = "pulse 1.6s ease-in-out infinite";
  }

  const buttonStyle: CSSProperties | undefined = state.pressing
    ? { transform: "translateY(1px) scale(0.98)" }
    : undefined;

  return {
    panelClass: basePanel.join(" "),
    panelStyle: Object.keys(panelStyle).length > 0 ? panelStyle : undefined,
    buttonClass: "main-screen-button",
    buttonStyle,
    badgeClass: "main-screen-badge",
  };
}

export type MainScreenBtnProps = {
  open: boolean;
  onToggle?: () => void;
  links?: ModuleLink[];
  effect?: MainScreenBtnEffectConfig;
  title?: string;
  target?: "_self" | "_blank";
};

export function MainScreenBtnPanel(props: MainScreenBtnProps) {
  const { open, onToggle, title = "Modules", target = "_self" } = props;
  const [hovering, setHovering] = React.useState(false);
  const [pressing, setPressing] = React.useState(false);

  const vis = useMainScreenBtnEffect({ open, hovering, pressing }, props.effect);

  const links = React.useMemo(() => props.links ?? getDefaultModuleLinks(), [props.links]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggle?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onToggle]);

  if (!open) return null;

  return (
    <div className={vis.panelClass} style={vis.panelStyle}>
      <span className={vis.badgeClass}>{title}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target={target}
            rel={target === "_blank" ? "noreferrer" : undefined}
            className={vis.buttonClass}
            style={vis.buttonStyle}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onMouseDown={() => setPressing(true)}
            onMouseUp={() => setPressing(false)}
            onTouchStart={() => setPressing(true)}
            onTouchEnd={() => setPressing(false)}
            data-mod={link.id}
          >
            {link.label}
          </a>
        ))}
        <button
          type="button"
          className={vis.buttonClass}
          style={vis.buttonStyle}
          onClick={onToggle}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onMouseDown={() => setPressing(true)}
          onMouseUp={() => setPressing(false)}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function MainScreenBtnDock(
  props: Omit<MainScreenBtnProps, "open" | "onToggle"> & { overlayClassName?: string },
) {
  const gesture = useMainScreenGesture();
  return (
    <>
      <div
        {...gesture.bindTargetProps()}
        className={props.overlayClassName ?? "main-screen-overlay"}
      />
      <MainScreenBtnPanel
        open={gesture.open}
        onToggle={gesture.toggle}
        links={props.links}
        effect={props.effect}
        title={props.title}
        target={props.target}
      />
    </>
  );
}