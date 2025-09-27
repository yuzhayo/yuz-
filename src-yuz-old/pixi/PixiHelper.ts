import { Container } from 'pixi.js';
import type { DisplayObject } from 'pixi.js';
import type { Position, Scale } from './PixiTypes.js';

export class PixiHelper {
    static isWebGLAvailable(): boolean {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
        } catch {
            return false;
        }
    }

    static createContainer(): Container {
        return new Container();
    }

    static applyPosition(object: DisplayObject, position: Position): void {
        object.x = (position.xPct / 100) * object.parent.width;
        object.y = (position.yPct / 100) * object.parent.height;
    }

    static applyScale(object: DisplayObject, scale: Scale): void {
        const scaleFactor = scale.pct / 100;
        object.scale.set(scaleFactor, scaleFactor);
    }

    static cleanup(container: Container): void {
        try { 
            if (typeof (container as any)._cleanup === 'function') {
                (container as any)._cleanup();
            }
            container.destroy({ children: true });
        } catch (e) {
            console.warn('Error during container cleanup:', e);
        }
    }

    static transformEventCoordinates(
        event: MouseEvent | TouchEvent | PointerEvent, 
        container: Container & { parent?: { view?: HTMLCanvasElement } }
    ): { x: number, y: number } {
        const view = container.parent?.view;
        if (!view) {
            console.warn('Container has no view element');
            return { x: 0, y: 0 };
        }
        
        const bounds = view.getBoundingClientRect();
        const x = ('clientX' in event ? event.clientX : event.touches?.[0]?.clientX ?? 0) - bounds.left;
        const y = ('clientY' in event ? event.clientY : event.touches?.[0]?.clientY ?? 0) - bounds.top;
        return { x, y };
    }
}