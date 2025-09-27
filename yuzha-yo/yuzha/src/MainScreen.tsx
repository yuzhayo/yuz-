import React, { useEffect, useRef, useState } from "react";
import "./MainScreenStyles.css";
import {
  detectRenderer,
  type RendererMode,
  type RendererAvailability,
  type DetectedRenderer,
} from "./MainScreenRendererDetector";
import { MainScreenBtnPanel } from "./MainScreenBtn";
import { useMainScreenGesture } from "./MainScreenGesture";
import MainScreenRendererDetector from "./MainScreenRendererDetector";
import MainScreenUpdater from "./MainScreenUpdater";
import MainScreenApiTester from "./MainScreenApiTester";
import { 
  CanvasAdapterManager, 
  createCanvasAdapter, 
  detectBestRenderer,
  registerDefaultAdapters 
} from "@shared/stages1";
import { LayerBasicCore } from "@shared/layer";

type MainScreenRenderers = {
  webgl?: React.ReactNode;
  three?: React.ReactNode;
};

type MainScreenProps = {
  rendererMode?: RendererMode;
  renderers?: MainScreenRenderers;
};

function mapRenderersToAvailability(renderers?: MainScreenRenderers): RendererAvailability {
  return {
    webgl: renderers?.webgl != null || true, // WebGL is generally available
    three: renderers?.three != null || false, // Three.js might not be bundled
  };
}

export default function MainScreen(props: MainScreenProps) {
  const mode = props.rendererMode ?? "auto";
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasManager, setCanvasManager] = useState<CanvasAdapterManager | null>(null);
  const [layerSystem, setLayerSystem] = useState<LayerBasicCore | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const availability = React.useMemo(
    () => mapRenderersToAvailability(props.renderers),
    [props.renderers],
  );
  const detected = React.useMemo(() => detectRenderer(mode, availability), [mode, availability]);
  const gesture = useMainScreenGesture();

  // Initialize stages1 canvas system
  useEffect(() => {
    if (!containerRef.current) return;

    const initCanvas = async () => {
      try {
        // Register default adapters
        registerDefaultAdapters();
        
        // Detect best renderer
        const bestRenderer = detectBestRenderer();
        
        // Create canvas adapter
        const result = await createCanvasAdapter(containerRef.current!, {
          renderer: bestRenderer,
          debug: false,
          autoFallback: true
        });
        
        setCanvasManager(result.manager);
        setError(null);
        
        console.log(`[MainScreen] Initialized ${bestRenderer} renderer successfully`);
        
        // Initialize layer system if Three.js renderer is available
        if (bestRenderer === 'three' && result.renderer) {
          try {
            const layerSystem = new LayerBasicCore();
            await layerSystem.loadFromConfig("@shared/layer/MainConfig.json");
            layerSystem.attachToThreeScene((result.renderer as any).scene);
            setLayerSystem(layerSystem);
            console.log('[MainScreen] Layer system initialized successfully');
          } catch (layerErr) {
            console.error('[MainScreen] Failed to initialize layer system:', layerErr);
          }
        }
        
      } catch (err) {
        console.error('[MainScreen] Failed to initialize canvas:', err);
        setError(`Failed to initialize renderer: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    initCanvas();

    return () => {
      if (layerSystem) {
        layerSystem.dispose();
      }
      if (canvasManager) {
        canvasManager.dispose();
      }
    };
  }, []);

  const stageContent = React.useMemo(() => {
    if (detected.kind === "webgl") return props.renderers?.webgl ?? null;
    if (detected.kind === "three") return props.renderers?.three ?? null;
    return null;
  }, [detected, props.renderers]);

  return (
    <div className="main-screen">
      {/* Fixed 2048x2048 background canvas from stages1 */}
      <div 
        ref={containerRef}
        className="main-screen-stage"
        aria-hidden="true"
        data-renderer={detected.kind}
        data-renderer-via={detected.via}
        data-renderer-fallback={
          detected.via === "fallback" ? (detected.fallbackFrom ?? "unknown") : undefined
        }
      >
        {stageContent}
      </div>

      {/* Show error if canvas initialization failed */}
      {error && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(239, 68, 68, 0.9)",
          color: "white",
          padding: "1rem",
          borderRadius: "8px",
          zIndex: 1000,
          maxWidth: "400px",
          textAlign: "center"
        }}>
          <h3>Canvas Error</h3>
          <p>{error}</p>
        </div>
      )}

      <div {...gesture.bindTargetProps()} className="main-screen-overlay" />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <div style={{ textAlign: "center", display: "grid", gap: "1rem" }}>
          <h1 className="main-screen-headline">Display host ready.</h1>
          <p className="main-screen-subtext">Hold anywhere to access modules</p>
        </div>
      </div>

      <MainScreenBtnPanel
        open={gesture.open}
        onToggle={gesture.toggle}
        effect={{ kind: "fade" }}
        title="Modules"
        target="_self"
      />

      <MainScreenRendererDetector 
        visible={gesture.open} 
        rendererMode={mode}
        availability={availability}
      />
      <MainScreenApiTester visible={gesture.open} />
      <MainScreenUpdater visible={gesture.open} />
    </div>
  );
}