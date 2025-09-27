export const DEFAULT_DPR_CAP = 2;
export const STAGE_WIDTH = 2048;
export const STAGE_HEIGHT = 2048;

export const RENDERER_MODES = {
    WEBGL: 'webgl',
    CANVAS: 'canvas',
    PIXI: 'pixi'
} as const;

export const TRANSFORM_DEFAULTS = {
    SCALE: 1,
    ROTATION: 0,
    POSITION_X: 0,
    POSITION_Y: 0
} as const;

export const ANIMATION_DEFAULTS = {
    FADE_DURATION: 1500,
    PULSE_PERIOD: 1800,
    SHOCKWAVE_PERIOD: 1200
} as const;
