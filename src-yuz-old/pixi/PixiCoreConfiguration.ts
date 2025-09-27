import { DEFAULT_DPR_CAP, STAGE_HEIGHT, STAGE_WIDTH } from './PixiConstant.js';
import type { PixiApplicationOptions } from './PixiTypes.js';

export class PixiCoreConfiguration {
    constructor(private options: Partial<PixiApplicationOptions> = {}) {
        this.validateOptions(options);
    }

    private validateOptions(options: Partial<PixiApplicationOptions>): void {
        if (options.width && options.width <= 0) {
            throw new Error('Width must be greater than 0');
        }
        if (options.height && options.height <= 0) {
            throw new Error('Height must be greater than 0');
        }
        if (options.dprCap && (options.dprCap < 1 || options.dprCap > 4)) {
            throw new Error('DPR cap must be between 1 and 4');
        }
        if (options.backgroundAlpha !== undefined && 
            (options.backgroundAlpha < 0 || options.backgroundAlpha > 1)) {
            throw new Error('Background alpha must be between 0 and 1');
        }
    }

    public getApplicationOptions(): PixiApplicationOptions {
        const dpr = Math.min(
            this.options.dprCap ?? DEFAULT_DPR_CAP,
            window.devicePixelRatio || 1
        );

        return {
            width: this.options.width ?? STAGE_WIDTH,
            height: this.options.height ?? STAGE_HEIGHT,
            backgroundAlpha: this.options.backgroundAlpha ?? 0,
            antialias: this.options.antialias ?? true,
            autoDensity: true,
            resolution: dpr,
            powerPreference: this.options.powerPreference ?? 'default',
            ...this.options
        };
    }

    public getStageOptions() {
        return {
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT
        };
    }

    public getDPR(): number {
        return Math.min(
            this.options.dprCap ?? DEFAULT_DPR_CAP,
            window.devicePixelRatio || 1
        );
    }
}