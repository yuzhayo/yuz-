import { Application } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { PixiCoreConfiguration } from './PixiCoreConfiguration.js';
import type { PixiCoreInstance } from './PixiTypes.js';
import { PixiHelper } from './PixiHelper.js';

export class PixiCore {
    private app: Application;
    private static instance: PixiCore;

    private constructor(config: PixiCoreConfiguration) {
        this.app = new Application(config.getApplicationOptions());
    }

    public static getInstance(config?: PixiCoreConfiguration): PixiCore {
        if (!PixiCore.instance) {
            if (!config) throw new Error('Configuration required for initialization');
            PixiCore.instance = new PixiCore(config);
        }
        return PixiCore.instance;
    }

    public getPixiInstance(): PixiCoreInstance {
        if (!this.app) {
            throw new Error('PixiCore not initialized');
        }
        return {
            app: this.app,
            view: this.app.view,
            stage: this.app.stage
        };
    }

    public mount(element: HTMLElement): void {
        if (!element) {
            throw new Error('Mount element is required');
        }
        if (!this.app?.view) {
            throw new Error('PixiCore not initialized properly');
        }
        element.appendChild(this.app.view as HTMLCanvasElement);
    }

    public addToStage(container: Container): void {
        if (!this.app?.stage) {
            throw new Error('PixiCore stage not initialized');
        }
        this.app.stage.addChild(container);
    }

    public removeFromStage(container: Container): void {
        if (!this.app?.stage) {
            throw new Error('PixiCore stage not initialized');
        }
        if (container.parent === this.app.stage) {
            this.app.stage.removeChild(container);
        }
    }

    public destroy(): void {
        if (!this.app) {
            return;
        }
        this.app.destroy(true, {
            children: true,
            texture: true,
            baseTexture: true
        });
        // Safe cleanup of singleton instance
        if (PixiCore.instance === this) {
            PixiCore.instance = undefined as any;
        }
    }

    public static isWebGLSupported(): boolean {
        return PixiHelper.isWebGLAvailable();
    }

    public ticker(callback: (delta: number) => void): void {
        if (!this.app?.ticker) {
            throw new Error('PixiCore ticker not initialized');
        }
        this.app.ticker.add(callback);
    }

    public stopTicker(callback: (delta: number) => void): void {
        if (!this.app?.ticker) {
            throw new Error('PixiCore ticker not initialized');
        }
        this.app.ticker.remove(callback);
    }

    public getApp(): Application {
        if (!this.app) {
            throw new Error('PixiCore not initialized');
        }
        return this.app;
    }
}