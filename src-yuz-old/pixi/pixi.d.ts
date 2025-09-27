declare module '@shared/pixi' {
    import type { Application, Container, DisplayObject } from 'pixi.js';

    export interface PixiCoreInstance {
        app: Application;
        view: HTMLCanvasElement;
        stage: Container;
    }

    export interface PixiApplicationOptions {
        dprCap?: number;
        backgroundAlpha?: number;
        backgroundColor?: number | string;
        width?: number;
        height?: number;
        antialias?: boolean;
        autoDensity?: boolean;
        resolution?: number;
        forceCanvas?: boolean;
        powerPreference?: 'default' | 'high-performance' | 'low-power';
        autoStart?: boolean;
    }

    export interface Position {
        xPct: number;
        yPct: number;
    }

    export interface Scale {
        pct: number;
    }

    export class PixiCore {
        static getInstance(config?: PixiCoreConfiguration): PixiCore;
        mount(element: HTMLElement): void;
        addToStage(container: Container): void;
        removeFromStage(container: Container): void;
        destroy(): void;
        ticker(callback: (delta: number) => void): void;
        stopTicker(callback: (delta: number) => void): void;
        getPixiInstance(): PixiCoreInstance;
    }

    export class PixiCoreConfiguration {
        constructor(options?: Partial<PixiApplicationOptions>);
        getApplicationOptions(): PixiApplicationOptions;
    }

    export class PixiHelper {
        static isWebGLAvailable(): boolean;
        static createContainer(): Container;
        static applyPosition(object: DisplayObject, position: Position): void;
        static applyScale(object: DisplayObject, scale: Scale): void;
        static cleanup(container: Container): void;
    }

    export const STAGE_WIDTH: number;
    export const STAGE_HEIGHT: number;
    export const DEFAULT_DPR_CAP: number;
}