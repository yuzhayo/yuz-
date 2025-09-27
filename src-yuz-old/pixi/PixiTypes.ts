import type { 
    Application, 
    Container, 
    ICanvas, 
    ColorSource,
    EventMode
} from 'pixi.js';

type WebGLPowerPreference = 'default' | 'high-performance' | 'low-power';

export type PixiEventSystemFeatures = {
    move: boolean;
    globalMove: boolean;
    click: boolean;
    wheel: boolean;
};

export interface PixiApplicationOptions {
    dprCap?: number;
    backgroundAlpha?: number;
    backgroundColor?: ColorSource;
    width?: number;
    height?: number;
    antialias?: boolean;
    autoDensity?: boolean;
    eventMode?: EventMode;
    eventFeatures?: Partial<PixiEventSystemFeatures>;
    resolution?: number;
    forceCanvas?: boolean;
    powerPreference?: WebGLPowerPreference;
    autoStart?: boolean;
}

export interface RenderableObject {
    setup(): Promise<void>;
    update(delta: number): void;
    cleanup(): void;
}

export interface AssetManifest {
    id: string;
    url: string;
}

export interface PixiCoreInstance {
    app: Application;
    view: ICanvas;
    stage: Container;
}

export type SpinDirection = 'cw' | 'ccw';

export type EffectType = 
    | 'fade'
    | 'pulse'
    | 'tilt'
    | 'glow'
    | 'bloom'
    | 'distort'
    | 'shockwave';

export interface BaseEffect {
    type: EffectType;
}

export interface Position {
    xPct: number;
    yPct: number;
}

export interface Scale {
    pct: number;
}

export interface ImageReference {
    kind: 'url' | 'urlId';
    id?: string;
    url?: string;
}