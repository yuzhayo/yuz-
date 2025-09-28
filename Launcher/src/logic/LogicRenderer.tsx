import React from "react";
import type { LogicConfig } from "./sceneTypes";
import { mountRenderer, type EngineAdapterHandle, type RendererType } from "./LogicEngineAdapter";

export type LogicRendererProps = {
  cfg: LogicConfig;
  renderer?: RendererType;
  className?: string;
};

export default function LogicRenderer(props: LogicRendererProps) {
  const { cfg, renderer = "pixi" } = props;
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let handle: EngineAdapterHandle | null = null;

    let cancelled = false;
    (async () => {
      try {
        handle = await mountRenderer(el, cfg, renderer, { 
          dprCap: 2, 
          resizeTo: window 
        });
      } catch (e) {
        if (!cancelled) {
          console.error(`[LogicRenderer] Failed to mount ${renderer} renderer:`, e);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        handle?.dispose();
      } catch (error) {
        console.error(`[LogicRenderer] Error disposing ${renderer} renderer:`, error);
      }
    };
  }, [cfg, renderer]);

  return <div ref={ref} className={props.className ?? "w-full h-full"} />;
}
